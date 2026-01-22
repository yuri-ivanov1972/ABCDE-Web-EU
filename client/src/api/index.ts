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

export interface HealthierProductsResponse {
  hasHealthierProducts: boolean;
  betterGrades: string[];
  count: number;
}

export const checkHealthierProducts = async (categoryId: number, currentGrade: string, store?: string): Promise<HealthierProductsResponse> => {
  let url = `${API_BASE_URL}/categories/${categoryId}/has-healthier-products?currentGrade=${currentGrade}`;
  if (store) {
    url += `&store=${store}`;
  }
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to check healthier products: ${response.status}`);
  }
  
  return response.json();
};

// Products API
export const getProducts = async (options: {
  categoryId?: number;
  page?: number;
  pageSize?: number;
  nutriScores?: NutriScoreGrade[];
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

export const getProductById = async (id: number, store?: 'rimi' | 'maxima'): Promise<ProductWithDetails> => {
  const params = new URLSearchParams();
  if (store) {
    params.set('store', store);
  }
  const queryString = params.toString();
  const url = queryString ? `${API_BASE_URL}/products/${id}?${queryString}` : `${API_BASE_URL}/products/${id}`;
  
  const response = await fetch(url);
  
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
