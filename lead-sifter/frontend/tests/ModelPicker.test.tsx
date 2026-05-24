import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ModelPicker from '../src/components/ModelPicker';

vi.mock('../src/lib/api', () => ({
  api: {
    listModels: vi.fn().mockResolvedValue({ models: ['gpt-4o', 'gpt-4o-mini'] }),
  },
}));

describe('ModelPicker', () => {
  it('shows provider switch + model dropdown', async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <ModelPicker provider="openai" value="" onChange={() => {}} onProviderChange={() => {}} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('OpenAI')).toBeInTheDocument();
    expect(await screen.findByText('Anthropic')).toBeInTheDocument();
  });
});
