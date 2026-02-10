import { useState, useEffect } from 'react';
import { TagService } from '../services';
import type { Tag } from '../types/collaboration';
import './TagFilter.css';

interface TagFilterProps {
  selectedTags: string[];
  onTagsChange: (tagKeys: string[]) => void;
  variant?: 'default' | 'slim';
}

export function TagFilter({ selectedTags, onTagsChange, variant = 'default' }: TagFilterProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    TagService.getActiveCollaborationTags()
      .then(setTags)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

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

  if (isLoading) {
    return <div className={`tag-filter__loading ${variant === 'slim' ? 'tag-filter__loading--slim' : ''}`}>Loading tags...</div>;
  }

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className={`tag-filter ${variant === 'slim' ? 'tag-filter--slim' : ''}`}>
      <div className="tag-filter__header">
        <h4>Filter by Tags</h4>
        {selectedTags.length > 0 && (
          <button 
            type="button" 
            className="tag-filter__clear"
            onClick={clearAll}
          >
            Clear all
          </button>
        )}
      </div>
      
      <div className="tag-filter__tags">
        {tags.map(tag => {
          const total = tag.collaborationCount || 0;
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
