import './TagFilter.css';

interface TagOption {
  key: string;
  name: string;
  count: number;
}

interface TagFilterProps {
  selectedTags: string[];
  onTagsChange: (tagKeys: string[]) => void;
  variant?: 'default' | 'slim';
  tags: TagOption[];
  loading?: boolean;
}

export function TagFilter({
  selectedTags,
  onTagsChange,
  variant = 'default',
  tags,
  loading = false
}: TagFilterProps) {

  const toggleTag = (tagKey: string) => {
    if (selectedTags.includes(tagKey)) {
      onTagsChange(selectedTags.filter(t => t !== tagKey));
    } else {
      onTagsChange([...selectedTags, tagKey]);
    }
  };

  const clearAll = () => {
    onTagsChange([]);
  };

  if (!loading && tags.length === 0) {
    return null;
  }

  return (
    <div className={`tag-filter ${variant === 'slim' ? 'tag-filter--slim' : ''}`}>
      <div className="tag-filter__header">
        <h4>Filter by Tags</h4>
        {!loading && selectedTags.length > 0 && (
          <button 
            type="button" 
            className="tag-filter__clear"
            onClick={clearAll}
          >
            Clear all
          </button>
        )}
      </div>
      
      <div className={`tag-filter__tags ${loading ? 'tag-filter__tags--placeholder' : ''}`}>
        {loading
          ? Array.from({ length: variant === 'slim' ? 5 : 7 }, (_, index) => (
              <span
                key={index}
                aria-hidden="true"
                className={`tag-filter__tag tag-filter__tag--placeholder tag-filter__tag--placeholder-${(index % 3) + 1}`}
              >
                <span className="tag-filter__placeholder-label" />
                <span className="tag-filter__placeholder-count" />
              </span>
            ))
          : tags.map(tag => {
              const total = tag.count || 0;
              if (total <= 0) return null;

              const isSelected = selectedTags.includes(tag.key);

              return (
                <button
                  key={tag.key}
                  type="button"
                  className={`tag-filter__tag ${isSelected ? 'tag-filter__tag--selected' : ''}`}
                  onClick={() => toggleTag(tag.key)}
                >
                  <span>{tag.name}</span>
                  <span className="tag-filter__count">({total})</span>
                </button>
              );
            })}
      </div>
    </div>
  );
}
