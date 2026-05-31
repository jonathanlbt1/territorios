import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EmptyState from '../../src/components/EmptyState';

// Mock icon component
const MockIcon = (props) => (
  <svg data-testid="mock-icon" className={props.className} />
);

describe('EmptyState', () => {
  describe('rendering', () => {
    it('should render title', () => {
      render(<EmptyState title="No items found" />);
      
      expect(screen.getByText('No items found')).toBeInTheDocument();
    });

    it('should render title with correct heading level', () => {
      render(<EmptyState title="Test Title" />);
      
      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading).toHaveTextContent('Test Title');
    });

    it('should render with correct CSS class', () => {
      const { container } = render(<EmptyState title="Test" />);
      
      expect(container.querySelector('.empty-state')).toBeInTheDocument();
    });

    it('should render title with correct CSS class', () => {
      render(<EmptyState title="Test Title" />);
      
      const heading = screen.getByText('Test Title');
      expect(heading).toHaveClass('empty-state-title');
    });
  });

  describe('icon prop', () => {
    it('should render icon when provided', () => {
      render(<EmptyState icon={MockIcon} title="Test" />);
      
      expect(screen.getByTestId('mock-icon')).toBeInTheDocument();
    });

    it('should apply correct CSS class to icon', () => {
      render(<EmptyState icon={MockIcon} title="Test" />);
      
      const icon = screen.getByTestId('mock-icon');
      expect(icon).toHaveClass('empty-state-icon');
    });

    it('should not render icon when not provided', () => {
      render(<EmptyState title="Test" />);
      
      expect(screen.queryByTestId('mock-icon')).not.toBeInTheDocument();
    });

    it('should not render icon when null', () => {
      render(<EmptyState icon={null} title="Test" />);
      
      expect(screen.queryByTestId('mock-icon')).not.toBeInTheDocument();
    });

    it('should not render icon when undefined', () => {
      render(<EmptyState icon={undefined} title="Test" />);
      
      expect(screen.queryByTestId('mock-icon')).not.toBeInTheDocument();
    });
  });

  describe('description prop', () => {
    it('should render description when provided', () => {
      render(
        <EmptyState 
          title="Test" 
          description="This is a description" 
        />
      );
      
      expect(screen.getByText('This is a description')).toBeInTheDocument();
    });

    it('should render description with correct CSS class', () => {
      render(
        <EmptyState 
          title="Test" 
          description="Test description" 
        />
      );
      
      const description = screen.getByText('Test description');
      expect(description).toHaveClass('empty-state-description');
    });

    it('should not render description when not provided', () => {
      const { container } = render(<EmptyState title="Test" />);
      
      expect(container.querySelector('.empty-state-description')).not.toBeInTheDocument();
    });

    it('should not render description when empty string', () => {
      const { container } = render(<EmptyState title="Test" description="" />);
      
      expect(container.querySelector('.empty-state-description')).not.toBeInTheDocument();
    });

    it('should not render description when null', () => {
      const { container } = render(<EmptyState title="Test" description={null} />);
      
      expect(container.querySelector('.empty-state-description')).not.toBeInTheDocument();
    });
  });

  describe('action prop', () => {
    it('should render action when provided', () => {
      render(
        <EmptyState 
          title="Test" 
          action={<button>Click me</button>} 
        />
      );
      
      expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
    });

    it('should wrap action in div with mt-4 class', () => {
      render(
        <EmptyState 
          title="Test" 
          action={<button data-testid="action-btn">Action</button>} 
        />
      );
      
      const button = screen.getByTestId('action-btn');
      expect(button.parentElement).toHaveClass('mt-4');
    });

    it('should not render action wrapper when not provided', () => {
      const { container } = render(<EmptyState title="Test" />);
      
      expect(container.querySelector('.mt-4')).not.toBeInTheDocument();
    });

    it('should not render action wrapper when null', () => {
      const { container } = render(<EmptyState title="Test" action={null} />);
      
      expect(container.querySelector('.mt-4')).not.toBeInTheDocument();
    });

    it('should render complex action elements', () => {
      render(
        <EmptyState 
          title="Test" 
          action={
            <div>
              <button>Primary</button>
              <button>Secondary</button>
            </div>
          } 
        />
      );
      
      expect(screen.getByRole('button', { name: 'Primary' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Secondary' })).toBeInTheDocument();
    });

    it('should handle action button clicks', () => {
      const handleClick = vi.fn();
      render(
        <EmptyState 
          title="Test" 
          action={<button onClick={handleClick}>Click</button>} 
        />
      );
      
      fireEvent.click(screen.getByRole('button'));
      
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('complete component', () => {
    it('should render all props together', () => {
      render(
        <EmptyState 
          icon={MockIcon}
          title="No Results"
          description="Try adjusting your search"
          action={<button>Clear filters</button>}
        />
      );
      
      expect(screen.getByTestId('mock-icon')).toBeInTheDocument();
      expect(screen.getByText('No Results')).toBeInTheDocument();
      expect(screen.getByText('Try adjusting your search')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
    });

    it('should render elements in correct order', () => {
      const { container } = render(
        <EmptyState 
          icon={MockIcon}
          title="Title"
          description="Description"
          action={<button>Action</button>}
        />
      );
      
      const emptyState = container.querySelector('.empty-state');
      const children = emptyState.children;
      
      // Icon should be first
      expect(children[0].tagName.toLowerCase()).toBe('svg');
      // Title should be second
      expect(children[1].tagName.toLowerCase()).toBe('h3');
      // Description should be third
      expect(children[2].tagName.toLowerCase()).toBe('p');
      // Action wrapper should be fourth
      expect(children[3].tagName.toLowerCase()).toBe('div');
    });
  });

  describe('Portuguese content', () => {
    it('should render Portuguese title', () => {
      render(<EmptyState title="Nenhum território encontrado" />);
      
      expect(screen.getByText('Nenhum território encontrado')).toBeInTheDocument();
    });

    it('should render Portuguese description', () => {
      render(
        <EmptyState 
          title="Vazio"
          description="Não há designações pendentes"
        />
      );
      
      expect(screen.getByText('Não há designações pendentes')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle very long title', () => {
      const longTitle = 'A'.repeat(200);
      render(<EmptyState title={longTitle} />);
      
      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });

    it('should handle very long description', () => {
      const longDescription = 'B'.repeat(500);
      render(<EmptyState title="Test" description={longDescription} />);
      
      expect(screen.getByText(longDescription)).toBeInTheDocument();
    });

    it('should handle special characters in title', () => {
      const specialTitle = '<Test> & "Special" Characters';
      render(<EmptyState title={specialTitle} />);
      
      expect(screen.getByText(specialTitle)).toBeInTheDocument();
    });

    it('should handle unicode in content', () => {
      render(
        <EmptyState 
          title="🔍 Busca"
          description="Nenhum resultado encontrado 😢"
        />
      );
      
      expect(screen.getByText('🔍 Busca')).toBeInTheDocument();
      expect(screen.getByText('Nenhum resultado encontrado 😢')).toBeInTheDocument();
    });
  });
});
