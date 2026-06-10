import { Store } from '@/types';
import { useTranslation } from 'react-i18next';

interface StoreFilterProps {
  selectedStore?: Store;
  onStoreChange: (store?: Store) => void;
}

const StoreFilter: React.FC<StoreFilterProps> = ({ selectedStore, onStoreChange }) => {
  const { t } = useTranslation('filters');
  
  const stores: { value: Store | undefined; label: string; color: string }[] = [
    { value: undefined, label: t('store.all'), color: 'bg-gray-600' },
    { value: 'rimi', label: 'Rimi', color: 'bg-[#D33731]' },
    { value: 'maxima', label: 'Maxima', color: 'bg-[#24488B]' },
  ];

  return (
    <div className="flex space-x-2">
      {stores.map((store) => (
        <button
          key={store.value || 'all'}
          className={`
            px-3 py-1.5 rounded text-sm font-medium text-white
            ${store.color}
            ${selectedStore === store.value ? 'ring-2 ring-offset-2 ring-gray-400' : 'opacity-60 hover:opacity-100'}
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400
            transition-opacity
          `}
          onClick={() => onStoreChange(store.value)}
          aria-pressed={selectedStore === store.value}
          data-testid={`store-filter-${store.value || 'all'}`}
        >
          {store.label}
        </button>
      ))}
    </div>
  );
};

export default StoreFilter;
