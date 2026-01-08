import { Category, ProductWithDetails, ProductsResponse, NutriScoreGrade, SortOption, SortOrder, Store } from '../types';

// Base API URL
const API_BASE_URL = '/api';

// Categories API
export const getCategories = async (level?: number, parentId?: number): Promise<Category[]> => {
  let url = `${API_BASE_URL}/categories`;
  const params = new URLSearchParams();
  
  if (level !== undefined) {
    params.append('level', level.toString());
  }
  
  if (parentId !== undefined) {
    params.append('parentId', parentId.toString());
  }
  
  if (params.toString()) {
    url += `?${params.toString()}`;
  }
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch categories: ${response.status}`);
  }
  
  return response.json();
};

export const getCategoryById = async (id: number): Promise<Category> => {
  const response = await fetch(`${API_BASE_URL}/categories/${id}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch category: ${response.status}`);
  }
  
  return response.json();
};

export const getCategoryPath = async (id: number): Promise<Category[]> => {
  const response = await fetch(`${API_BASE_URL}/categories/${id}/path`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch category path: ${response.status}`);
  }
  
  return response.json();
};

// Products API
export const getProducts = async (options: {
  categoryId?: number;
  page?: number;
  pageSize?: number;
  nutriScores?: NutriScoreGrade[];
  sugarMin?: number;
  sugarMax?: number;
  fatMin?: number;
  fatMax?: number;
  proteinMin?: number;
  proteinMax?: number;
  saltMin?: number;
  saltMax?: number;
  sortBy?: SortOption;
  sortOrder?: SortOrder;
  search?: string;
  store?: Store;
}): Promise<ProductsResponse> => {
  const { 
    categoryId,
    page = 1,
    pageSize = 12,
    nutriScores,
    sugarMin,
    sugarMax,
    fatMin,
    fatMax,
    proteinMin,
    proteinMax,
    saltMin,
    saltMax,
    sortBy = 'name',
    sortOrder = 'asc',
    search,
    store
  } = options;
  
  const params = new URLSearchParams();
  
  if (categoryId !== undefined) {
    params.append('categoryId', categoryId.toString());
  }
  
  params.append('page', page.toString());
  params.append('pageSize', pageSize.toString());
  
  if (nutriScores && nutriScores.length > 0) {
    params.append('nutriScores', nutriScores.join(','));
  }
  
  if (sugarMin !== undefined) {
    params.append('sugarMin', sugarMin.toString());
  }
  
  if (sugarMax !== undefined) {
    params.append('sugarMax', sugarMax.toString());
  }
  
  if (fatMin !== undefined) {
    params.append('fatMin', fatMin.toString());
  }
  
  if (fatMax !== undefined) {
    params.append('fatMax', fatMax.toString());
  }
  
  if (proteinMin !== undefined) {
    params.append('proteinMin', proteinMin.toString());
  }
  
  if (proteinMax !== undefined) {
    params.append('proteinMax', proteinMax.toString());
  }
  
  if (saltMin !== undefined) {
    params.append('saltMin', saltMin.toString());
  }
  
  if (saltMax !== undefined) {
    params.append('saltMax', saltMax.toString());
  }
  
  params.append('sortBy', sortBy);
  params.append('sortOrder', sortOrder);
  
  if (search) {
    params.append('search', search);
  }
  
  if (store) {
    params.append('store', store);
  }
  
  const response = await fetch(`${API_BASE_URL}/products?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch products: ${response.status}`);
  }
  
  return response.json();
};

export const getProductById = async (id: number): Promise<ProductWithDetails> => {
  const response = await fetch(`${API_BASE_URL}/products/${id}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch product: ${response.status}`);
  }
  
  return response.json();
};

export const getProductBySku = async (sku: string): Promise<ProductWithDetails> => {
  const response = await fetch(`${API_BASE_URL}/products/sku/${sku}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch product by SKU: ${response.status}`);
  }
  
  return response.json();
};

export const getProductByRimiUrl = async (url: string): Promise<ProductWithDetails> => {
  // Encode the URL to handle special characters in path
  const encodedUrl = encodeURIComponent(url);
  const response = await fetch(`${API_BASE_URL}/products/url/${encodedUrl}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch product by URL: ${response.status}`);
  }
  
  return response.json();
};
