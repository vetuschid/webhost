import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LeadTable from '../src/components/LeadTable';

describe('LeadTable', () => {
  it('shows status color and pushed badge', () => {
    render(
      <LeadTable
        results={[
          {
            id: 1,
            run_id: 1,
            lead_id: 7,
            status: 'qualified',
            output: { qualified: true, score: 9 },
            reasoning: 'fits ICP',
            error: null,
            pushed_to_ghl: true,
            ghl_result: {},
          },
        ]}
      />,
    );
    expect(screen.getByText('qualified')).toBeInTheDocument();
    expect(screen.getByText('pushed')).toBeInTheDocument();
    expect(screen.getByText('#7')).toBeInTheDocument();
  });

  it('renders empty state', () => {
    render(<LeadTable results={[]} />);
    expect(screen.getByText('no results')).toBeInTheDocument();
  });
});
