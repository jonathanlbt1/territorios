import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const { mockApi, mockToast, mockNavigate } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  mockNavigate: vi.fn(),
}));

vi.mock('../../../src/services/api', () => ({
  default: mockApi,
}));

vi.mock('../../../src/contexts/ToastContext', () => ({
  useToast: () => mockToast,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../../src/components/MapViewer', () => ({
  default: ({ src, alt }) => <div data-testid="map-viewer" data-src={src}>{alt}</div>,
}));

import PublisherBlockDetail from '../../../src/pages/publisher/BlockDetail';

const renderComponent = (pubAssignId = '1') => {
  return render(
    <MemoryRouter initialEntries={[`/publisher/assignment/${pubAssignId}`]}>
      <Routes>
        <Route path="/publisher/assignment/:id" element={<PublisherBlockDetail />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('PublisherBlockDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load block detail data, display street observations, and not show Edit button', async () => {
    mockApi.get.mockImplementation((url) => {
      if (url === '/assignments/publisher-assignments/1') {
        return Promise.resolve({
          data: {
            id: 1,
            assignment_id: 10,
            block_number: 1,
            due_date: '2026-06-16T10:00:00Z',
            territory_number: '5',
            locality: 'Centro',
            map_filename: 'ter_5.png',
            territory_code: 'T-05'
          }
        });
      }
      if (url === '/assignments/publisher-assignments/1/houses') {
        return Promise.resolve({
          data: [
            {
              id: 1001,
              house_id: 2001,
              house_number: '120',
              street_id: 5,
              street_name: 'Rua Professora Luisinha',
              street_observations: 'Cuidado com cão bravo',
              block_number: 1,
              visited: false,
              dont_visit: false
            }
          ]
        });
      }
      return Promise.reject(new Error('Unknown url: ' + url));
    });

    renderComponent();

    // Verify header loads
    await waitFor(() => {
      expect(screen.getByText('Território 5 - Quadra 1')).toBeInTheDocument();
    });

    // Check observations are shown
    expect(screen.getByText('Obs: Cuidado com cão bravo')).toBeInTheDocument();

    // Verify Edit button is not present
    expect(screen.queryByText('Editar')).not.toBeInTheDocument();
  });
});
