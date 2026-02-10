import { useState, useEffect } from 'react';
import { TagService } from '../services';
import { TagUtils } from '../utils/tagUtils';
import type { Tag } from '../types/collaboration';
import './TagInput.css';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function TagInput({ tags, onChange, disabled, placeholder }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    TagService.getActiveCollaborationTags().then(setSuggestions).catch(console.error);
  }, []);

  const handleAddTag = (tagName: string) => {
    const trimmed = tagName.trim();
    if (!trimmed) return;

    const validation = TagUtils.validateTag(trimmed);
    if (!validation.valid) {
      setError(validation.error || 'Invalid tag');
      return;
    }

    if (tags.includes(trimmed)) {
      setError('Tag already added');
      return;
    }

    if (tags.length >= TagUtils.MAX_TAGS) {
      setError(`Maximum ${TagUtils.MAX_TAGS} tags`);
      return;
    }

    onChange([...tags, trimmed]);
    setInputValue('');
    setError(null);
  };

  const handleRemoveTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag(inputValue);
    }
  };

  // Filter available suggestions (exclude already selected)
  const availableTags = suggestions
    .filter(s => !tags.includes(s.name))
    .slice(0, 20);

  return (
    <div className="tag-input">
      <div className="tag-input__columns">
        {/* Selected Tags Section */}
        <div className="tag-input__section">
          <div className="tag-input__label">Selected ({tags.length})</div>
          <div className="tag-input__list tag-input__list--selected">
            {tags.length === 0 ? (
              <div className="tag-input__empty">No tags selected</div>
            ) : (
              tags.map((tag, i) => (
                <span key={i} className="tag-chip">
                  {tag}
                  {!disabled && (
                    <button
                      type="button"
                      className="tag-chip__remove"
                      onClick={() => handleRemoveTag(i)}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))
            )}
          </div>
        </div>

        {/* Available Tags Section */}
        {!disabled && (
          <div className="tag-input__section">
            <div className="tag-input__label">Available</div>
            <div className="tag-input__list tag-input__list--available">
              {availableTags.length === 0 ? (
                <div className="tag-input__empty">No more tags</div>
              ) : (
                availableTags.map(tag => {
                  const total = tag.collaborationCount || 0;
                  return (
                    <button
                      key={tag.key}
                      type="button"
                      className="tag-chip tag-chip--suggestion"
                      onClick={() => handleAddTag(tag.name)}
                    >
                      {tag.name}
                      {total > 0 && <span className="tag-chip__count">{total}</span>}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      {!disabled && (
        <div className="tag-input__input-wrapper">
          <input
            type="text"
            className="tag-input__input"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || 'Type custom tag + Enter...'}
            disabled={disabled}
          />
        </div>
      )}

      {error && <div className="tag-input__error">{error}</div>}
    </div>
  );
}
