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
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    TagService.getAllTags().then(setSuggestions).catch(console.error);
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
    setShowSuggestions(false);
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

  return (
    <div className="tag-input">
      {tags.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 12, opacity: 0.8, color: 'var(--white)', display: 'block', marginBottom: 4 }}>
            Selected tags:
          </label>
          <div className="tag-input__tags">
            {tags.map((tag, i) => (
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
            ))}
          </div>
        </div>
      )}
      
      {!disabled && suggestions.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 12, opacity: 0.8, color: 'var(--white)', display: 'block', marginBottom: 4 }}>
            Available tags (click to add):
          </label>
          <div className="tag-input__tags">
            {suggestions
              .filter(s => !tags.includes(s.name))
              .slice(0, 20)
              .map(tag => {
                const total = tag.projectCount + tag.collaborationCount;
                return (
                  <button
                    key={tag.key}
                    type="button"
                    className="tag-chip"
                    style={{ cursor: 'pointer', border: '1px solid var(--primary1-400)' }}
                    onClick={() => handleAddTag(tag.name)}
                  >
                    {tag.name}
                    {total > 0 && <span style={{ opacity: 0.7, marginLeft: 4 }}>({total})</span>}
                  </button>
                );
              })}
          </div>
        </div>
      )}
      
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
            placeholder={placeholder || 'Or type custom tag...'}
            disabled={disabled}
          />
        </div>
      )}
      
      {error && <div className="tag-input__error">{error}</div>}
    </div>
  );
}

