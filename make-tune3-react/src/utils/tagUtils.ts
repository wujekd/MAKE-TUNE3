export class TagUtils {
  static readonly MAX_TAGS = 10;
  static readonly MAX_TAG_LENGTH = 30;
  static readonly MIN_TAG_LENGTH = 2;

  static normalizeTag(tag: string): string {
    return tag
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }

  static validateTag(tag: string): { valid: boolean; error?: string } {
    const trimmed = tag.trim();
    if (trimmed.length < this.MIN_TAG_LENGTH) {
      return { valid: false, error: 'Tag too short' };
    }
    if (trimmed.length > this.MAX_TAG_LENGTH) {
      return { valid: false, error: 'Tag too long' };
    }
    if (!/^[a-zA-Z0-9\s-]+$/.test(trimmed)) {
      return { valid: false, error: 'Only letters, numbers, spaces allowed' };
    }
    return { valid: true };
  }

  static validateTags(tags: string[]): { valid: boolean; error?: string } {
    if (tags.length > this.MAX_TAGS) {
      return { valid: false, error: `Maximum ${this.MAX_TAGS} tags` };
    }
    for (const tag of tags) {
      const result = this.validateTag(tag);
      if (!result.valid) return result;
    }
    return { valid: true };
  }

  static normalizeTags(tags: string[]): { display: string[]; keys: string[] } {
    const uniqueTags = Array.from(new Set(tags.map(t => t.trim()).filter(Boolean)));
    const display = uniqueTags.slice(0, this.MAX_TAGS);
    const keys = display.map(t => this.normalizeTag(t));
    return { display, keys };
  }
}

