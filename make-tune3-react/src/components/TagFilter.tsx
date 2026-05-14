import { useMemo, useState } from 'react';
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
  showHeader?: boolean;
  searchable?: boolean;
}

export function TagFilter({
  selectedTags,
  onTagsChange,
  variant = 'default',
  tags,
  loading = false,
  showHeader = true,
  searchable = false
}: TagFilterProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const visibleTags = useMemo(() => {
    const trimmedSearch = searchTerm.trim().toLowerCase();
    if (!trimmedSearch) return tags;
    return tags.filter(tag =>
      tag.name.toLowerCase().includes(trimmedSearch) ||
      tag.key.toLowerCase().includes(trimmedSearch)
    );
  }, [searchTerm, tags]);

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
      {showHeader && (
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
      )}

      {searchable && (
        <div className="tag-filter__search-row">
          <input
            className="tag-filter__search"
            type="search"
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            placeholder="Search tags"
            aria-label="Search tags"
            disabled={loading}
          />
          {!showHeader && !loading && selectedTags.length > 0 && (
            <button
              type="button"
              className="tag-filter__clear tag-filter__clear--inline"
              onClick={clearAll}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {!showHeader && !searchable && !loading && selectedTags.length > 0 && (
        <div className="tag-filter__header tag-filter__header--actions-only">
          <button 
            type="button" 
            className="tag-filter__clear"
            onClick={clearAll}
          >
            Clear all
          </button>
        </div>
      )}
      
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
          : visibleTags.map(tag => {
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
        {!loading && visibleTags.length === 0 && (
          <span className="tag-filter__empty">No tags match</span>
        )}
      </div>
    </div>
  );
}
