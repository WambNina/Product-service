class ModularPricingService {
  
  /**
   * Calcule le prix final basé sur les attributs sélectionnés
   * @param {string} productId 
   * @param {Object} selectedValues - { memory: 'uuid-256', color: 'uuid-red' }
   */
  async calculatePrice(productId, selectedValues) {
    // 1. Récupérer le produit avec ses attributs configurés
    const product = await Product.findByPk(productId, {
      include: [
        {
          model: AttributeDefinition,
          as: 'attributeDefinitions',
          include: [{ model: AttributeValue, as: 'values' }],
          order: [['priority', 'ASC']]
        }
      ]
    });

    if (!product) throw new Error('Produit non trouvé');

    let calculationBreakdown = {
      basePrice: product.basePrice,
      steps: [],
      finalPrice: product.basePrice,
      appliedModifiers: []
    };

    let currentPrice = product.basePrice;

    // 2. Traiter les attributs par ordre de priorité
    for (const attrDef of product.attributeDefinitions) {
      const selectedValueId = selectedValues[attrDef.code];
      
      if (!selectedValueId) {
        if (attrDef.isRequired) {
          throw new Error(`Attribut requis manquant: ${attrDef.name}`);
        }
        continue;
      }

      const value = attrDef.values.find(v => v.id === selectedValueId);
      if (!value) continue;

      const step = this.applyPriceImpact(
        currentPrice, 
        value, 
        attrDef.pricingType,
        attrDef.name
      );

      calculationBreakdown.steps.push(step);
      currentPrice = step.newPrice;

      if (attrDef.pricingType === 'modifier') {
        calculationBreakdown.appliedModifiers.push({
          attribute: attrDef.name,
          value: value.displayValue,
          impact: step.impact,
          impactType: value.priceImpactType
        });
      }
    }

    calculationBreakdown.finalPrice = currentPrice;
    
    return calculationBreakdown;
  }

  applyPriceImpact(currentPrice, attributeValue, pricingType, attributeName) {
    const { priceImpact, priceImpactType, value } = attributeValue;

    let newPrice = currentPrice;
    let impactDescription = '';

    switch (pricingType) {
      case 'fixed':
        // La capacité définit le prix de base
        if (priceImpactType === 'fixed') {
          newPrice = priceImpact;
          impactDescription = `Prix fixé à ${priceImpact}€ par ${attributeName}`;
        }
        break;

      case 'modifier':
        // La couleur modifie le prix actuel
        if (priceImpactType === 'absolute') {
          newPrice = currentPrice + priceImpact;
          impactDescription = priceImpact >= 0 
            ? `+${priceImpact}€ pour ${value}`
            : `${priceImpact}€ pour ${value}`;
        } else if (priceImpactType === 'percentage') {
          const modifier = currentPrice * (priceImpact / 100);
          newPrice = currentPrice + modifier;
          impactDescription = priceImpact >= 0
            ? `+${priceImpact}% (${modifier.toFixed(2)}€) pour ${value}`
            : `${priceImpact}% (${modifier.toFixed(2)}€) pour ${value}`;
        }
        break;

      case 'none':
        impactDescription = `${attributeName}: ${value} (sans impact prix)`;
        break;
    }

    return {
      attribute: attributeName,
      value: value,
      previousPrice: currentPrice,
      newPrice: newPrice,
      impact: newPrice - currentPrice,
      description: impactDescription
    };
  }

  /**
   * Génère toutes les combinaisons possibles avec leurs prix
   * Utile pour afficher une grille de prix côté frontend
   */
  async generatePriceMatrix(productId) {
    const product = await Product.findByPk(productId, {
      include: [
        {
          model: AttributeDefinition,
          as: 'attributeDefinitions',
          where: { isVariant: true },
          include: [{ model: AttributeValue, as: 'values' }]
        }
      ]
    });

    const variantAttributes = product.attributeDefinitions.filter(
      ad => ad.pricingType === 'fixed' || ad.pricingType === 'modifier'
    );

    // Générer toutes les combinaisons
    const combinations = this.cartesianProduct(
      variantAttributes.map(attr => 
        attr.values.map(v => ({
          attributeCode: attr.code,
          attributeName: attr.name,
          valueId: v.id,
          value: v.value,
          pricingType: attr.pricingType,
          priceImpact: v.priceImpact,
          priceImpactType: v.priceImpactType
        }))
      )
    );

    // Calculer le prix pour chaque combinaison
    const matrix = await Promise.all(
      combinations.map(async (combo) => {
        const selectedValues = {};
        combo.forEach(item => {
          selectedValues[item.attributeCode] = item.valueId;
        });

        const priceResult = await this.calculatePrice(productId, selectedValues);
        
        return {
          combination: combo.map(c => ({
            attribute: c.attributeName,
            value: c.value
          })),
          price: priceResult.finalPrice,
          breakdown: priceResult.steps,
          sku: this.generateSku(productId, combo)
        };
      })
    );

    return matrix;
  }

  cartesianProduct(arrays) {
    return arrays.reduce((a, b) => 
      a.flatMap(d => b.map(e => [d, e].flat()))
    );
  }

  generateSku(productId, combination) {
    const parts = combination.map(c => 
      `${c.attributeCode.substring(0, 3).toUpperCase()}-${c.value.substring(0, 3).toUpperCase()}`
    );
    return `${productId.substring(0, 4)}-${parts.join('-')}`;
  }
}

module.exports = new ModularPricingService();