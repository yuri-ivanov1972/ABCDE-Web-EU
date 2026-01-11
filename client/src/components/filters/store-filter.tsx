import { Store } from '@/types';
import { useTranslation } from 'react-i18next';
import rimiLogo from '@assets/rimi-logo.svg';
import maximaLogo from '@assets/maxima-logo.svg';

interface StoreFilterProps {
  selectedStore?: Store;
  onStoreChange: (store?: Store) => void;
}

const StoreFilter: React.FC<StoreFilterProps> = ({ selectedStore, onStoreChange }) => {
  const { t } = useTranslation('filters');
  
  const stores: { value: Store | undefined; label: string; logo?: string; isAll?: boolean }[] = [
    { value: undefined, label: t('store.all'), isAll: true },
    { value: 'rimi', label: 'Rimi', logo: rimiLogo },
    { value: 'maxima', label: 'Maxima', logo: maximaLogo },
  ];

  return (
    <div className="flex space-x-2">
      {stores.map((store) => (
        <button
          key={store.value || 'all'}
          className={`
            px-2 py-1 rounded flex items-center justify-center
            ${store.isAll ? 'bg-gray-600 text-white text-sm font-medium min-w-[40px]' : ''}
            ${selectedStore === store.value ? 'ring-2 ring-offset-2 ring-gray-400' : 'opacity-60 hover:opacity-100'}
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400
            transition-opacity
          `}
          onClick={() => onStoreChange(store.value)}
          aria-pressed={selectedStore === store.value}
          aria-label={store.label}
          data-testid={`store-filter-${store.value || 'all'}`}
        >
          {store.isAll ? (
            store.label
          ) : (
            <img 
              src={store.logo} 
              alt={store.label} 
              className="h-6 w-auto"
            />
          )}
        </button>
      ))}
    </div>
  );
};

export default StoreFilter;
