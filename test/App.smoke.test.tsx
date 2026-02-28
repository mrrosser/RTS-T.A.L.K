import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../App';

describe('App smoke', () => {
  it('renders login screen', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'T.A.L.K' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue as Guest' })).toBeInTheDocument();
  });
});
