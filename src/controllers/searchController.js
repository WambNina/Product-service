const searchService = require('../services/searchService');
const catchAsync = require('../utils/catchAsync');

exports.searchProducts = catchAsync(async (req, res) => {
  const results = await searchService.searchProducts(req.query);
  
  res.status(200).json({
    success: true,
    data: results.data,
    pagination: results.pagination,
    meta: results.meta
  });
});

exports.filterProducts = catchAsync(async (req, res) => {
  const results = await searchService.filterProducts(req.query);
  
  res.status(200).json({
    success: true,
    data: results.data,
    pagination: results.pagination,
    filters: results.appliedFilters
  });
});