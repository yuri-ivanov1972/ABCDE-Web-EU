import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ 
  currentPage, 
  totalPages, 
  onPageChange 
}) => {
  // If total pages is 1 or less, don't render pagination
  console.log('Pagination: currentPage =', currentPage, 'totalPages =', totalPages);
  
  // Skip rendering pagination if there's only one page
  if (totalPages <= 1) return null;

  // Generate array of page numbers to display
  const getPageNumbers = () => {
    const maxPagesToShow = 5;
    
    if (totalPages <= maxPagesToShow) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    
    // Always show first page, last page, current page, and pages around current
    const pages = [1];
    
    const leftBound = Math.max(2, currentPage - 1);
    const rightBound = Math.min(totalPages - 1, currentPage + 1);
    
    // Add "..." if there's a gap between first page and leftBound
    if (leftBound > 2) {
      pages.push(-1); // -1 represents an ellipsis
    }
    
    // Add pages around current page
    for (let i = leftBound; i <= rightBound; i++) {
      pages.push(i);
    }
    
    // Add "..." if there's a gap between rightBound and last page
    if (rightBound < totalPages - 1) {
      pages.push(-2); // -2 represents another ellipsis (differentiate from first one)
    }
    
    // Add last page if it's not already included
    if (totalPages > 1) {
      pages.push(totalPages);
    }
    
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex flex-col items-center mt-8">
      {totalPages > 1 && (
        <p className="text-sm text-gray-600 mb-3">
          {`Lapa ${currentPage} no ${totalPages}`}
        </p>
      )}
      <nav className="inline-flex rounded-md shadow-md" aria-label="Pagination">
        {/* Previous button */}
        <button 
          className={`
            relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 
            ${currentPage === 1 
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
              : 'bg-white text-gray-500 hover:bg-gray-50 hover:text-primary'}
          `}
          onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Iepriekšējā lapa"
        >
          <span className="sr-only">Iepriekšējā</span>
          <ChevronLeft className="h-5 w-5" />
        </button>
        
        {/* Page numbers */}
        {pageNumbers.map((pageNumber, index) => (
          pageNumber < 0 ? (
            // Render ellipsis
            <span 
              key={`ellipsis-${index}`}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700"
            >
              ...
            </span>
          ) : (
            // Render page number
            <button
              key={pageNumber}
              className={`
                relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium
                ${pageNumber === currentPage 
                  ? 'bg-primary text-white font-semibold' 
                  : 'bg-white text-gray-700 hover:bg-gray-50 hover:text-primary'}
              `}
              onClick={() => onPageChange(pageNumber)}
              aria-current={pageNumber === currentPage ? 'page' : undefined}
            >
              {pageNumber}
            </button>
          )
        ))}
        
        {/* Next button */}
        <button 
          className={`
            relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 
            ${currentPage === totalPages 
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
              : 'bg-white text-gray-500 hover:bg-gray-50 hover:text-primary'}
          `}
          onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Nākamā lapa"
        >
          <span className="sr-only">Nākamā</span>
          <ChevronRight className="h-5 w-5" />
        </button>
      </nav>
    </div>
  );
};

export default Pagination;
