import { cleanup, fireEvent, render } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { ResilientMediaImage } from './resilient.media.image';

afterEach(cleanup);

describe('ResilientMediaImage', () => {
  it('replaces a failed image with an accessible unavailable state', () => {
    const { getByAltText, getByRole } = render(
      <ResilientMediaImage src="/missing-image.jpg" alt="media" />
    );

    fireEvent.error(getByAltText('media'));

    expect(getByRole('img', { name: 'Media unavailable' })).toBeTruthy();
  });

  it('tries again when the source changes', () => {
    const { getByAltText, getByRole, rerender } = render(
      <ResilientMediaImage src="/missing-image.jpg" alt="media" />
    );

    fireEvent.error(getByAltText('media'));
    expect(getByRole('img', { name: 'Media unavailable' })).toBeTruthy();

    rerender(<ResilientMediaImage src="/restored-image.jpg" alt="media" />);

    expect(getByAltText('media').getAttribute('src')).toBe(
      '/restored-image.jpg'
    );
  });
});
