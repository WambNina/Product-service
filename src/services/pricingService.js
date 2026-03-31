/**
 * Service de calcul de prix modulaire
 * 
 * - Capacité/Mémoire: définit le prix de base (fixed)
 * - Couleur/Taille/Poids: modifient le prix (modifier)
 */

class PricingService {
  
  /**
   * Calculer le prix d'un variant
   */
  calculateVariantPrice({ basePrice, color, size, weight, capacity }) {
    // Prix de base vient de la capacité si présente, sinon du produit
    let price = capacity?.basePrice || basePrice || 0;
    
    // Ajouter les modificateurs
    if (color?.priceImpact) price += color.priceImpact;
    if (size?.priceImpact) price += size.priceImpact;
    if (weight?.priceImpact) price += weight.priceImpact;
    
    return Math.round(price * 100) / 100;
  }

  /**
   * Calculer avec détail pour l'API
   */
  calculatePrice(product, attributes) {
    const basePrice = attributes.capacity?.basePrice || product.basePrice || 0;
    
    const modifiers = [];
    let currentPrice = basePrice;

    // Capacité (fixed)
    if (attributes.capacity) {
      modifiers.push({
        type: 'capacity',
        value: attributes.capacity.value,
        impact: basePrice,
        description: `Base: ${basePrice}€`
      });
    }

    // Couleur (modifier)
    if (attributes.color?.priceImpact) {
      const impact = attributes.color.priceImpact;
      currentPrice += impact;
      modifiers.push({
        type: 'color',
        value: attributes.color.value || attributes.color,
        impact: impact,
        description: impact >= 0 ? `Couleur +${impact}€` : `Couleur ${impact}€`
      });
    }

    // Taille (modifier)
    if (attributes.size?.priceImpact) {
      const impact = attributes.size.priceImpact;
      currentPrice += impact;
      modifiers.push({
        type: 'size',
        value: attributes.size.value || attributes.size,
        impact: impact,
        description: impact >= 0 ? `Taille +${impact}€` : `Taille ${impact}€`
      });
    }

    // Poids (modifier)
    if (attributes.weight?.priceImpact) {
      const impact = attributes.weight.priceImpact;
      currentPrice += impact;
      modifiers.push({
        type: 'weight',
        value: attributes.weight.value || attributes.weight,
        impact: impact,
        description: impact >= 0 ? `Poids +${impact}€` : `Poids ${impact}€`
      });
    }

    return {
      basePrice,
      modifiers,
      modifiersTotal: modifiers.reduce((sum, m) => sum + m.impact, 0),
      finalPrice: Math.round(currentPrice * 100) / 100,
      calculation: modifiers.map(m => m.description).join(' → ')
    };
  }

  /**
   * Calculer le breakdown pour un variant existant
   */
  calculateBreakdown(variant) {
    if (!variant) return null;
    
    return {
      base: variant.capacity?.basePrice || variant.calculatedPrice - this.sumModifiers(variant),
      color_modifier: variant.color?.priceImpact || 0,
      size_modifier: variant.size?.priceImpact || 0,
      weight_modifier: variant.weight?.priceImpact || 0,
      total: variant.finalPrice,
      is_override: !!variant.overridePrice,
      override_price: variant.overridePrice || null
    };
  }

  sumModifiers(variant) {
    let sum = 0;
    if (variant.color?.priceImpact) sum += variant.color.priceImpact;
    if (variant.size?.priceImpact) sum += variant.size.priceImpact;
    if (variant.weight?.priceImpact) sum += variant.weight.priceImpact;
    return sum;
  }
}

module.exports = new PricingService();