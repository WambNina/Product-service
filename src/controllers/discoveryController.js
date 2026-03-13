const discoveryService = require('../services/discoveryService');
const catchAsync = require('../utils/catchAsync');

exports.getProductReviews = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 10, rating } = req.query;
  
  const reviews = await discoveryService.getReviews(id, {
    page: parseInt(page),
    limit: parseInt(limit),
    rating: rating ? parseInt(rating) : null
  });

  res.status(200).json({
    success: true,
    data: reviews.data,
    pagination: reviews.pagination,
    summary: reviews.summary
  });
});

exports.getProductRating = catchAsync(async (req, res) => {
  const { id } = req.params;
  const rating = await discoveryService.getRating(id);

  res.status(200).json({
    success: true,
    data: rating
  });
});

exports.getRelatedProducts = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { limit = 4 } = req.query;
  
  const products = await discoveryService.getRelatedProducts(id, parseInt(limit));

  res.status(200).json({
    success: true,
    data: products
  });
});

exports.getFeaturedProducts = catchAsync(async (req, res) => {
  const { limit = 8, category } = req.query;
  
  const products = await discoveryService.getFeaturedProducts({
    limit: parseInt(limit),
    category
  });

  res.status(200).json({
    success: true,
    data: products
  });
});