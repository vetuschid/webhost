import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ColumnMapper from '../src/components/ColumnMapper';

describe('ColumnMapper', () => {
  it('renders one row per header and preselects guessed mapping', () => {
    render(
      <ColumnMapper
        headers={['Work Email', 'Job Title']}
        initial={{ 'Work Email': 'email', 'Job Title': 'title' }}
        onApply={() => {}}
      />,
    );
    expect(screen.getByText('Work Email')).toBeInTheDocument();
    expect(screen.getByText('Job Title')).toBeInTheDocument();
  });

  it('calls onApply with the current mapping', () => {
    const onApply = vi.fn();
    render(
      <ColumnMapper
        headers={['email']}
        initial={{ email: 'email' }}
        onApply={onApply}
      />,
    );
    fireEvent.click(screen.getByText('Apply mapping'));
    expect(onApply).toHaveBeenCalledWith({ email: 'email' });
  });
});
