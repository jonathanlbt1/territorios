import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BlockSelector from '../../src/components/BlockSelector';

describe('BlockSelector', () => {
  const defaultProps = {
    totalBlocks: 5,
    selectedBlocks: [],
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render the correct number of block buttons', () => {
      render(<BlockSelector {...defaultProps} />);
      
      const buttons = screen.getAllByRole('button').filter(btn => 
        !btn.textContent.includes('Todas') && !btn.textContent.includes('Limpar')
      );
      expect(buttons).toHaveLength(5);
    });

    it('should display block numbers for unselected blocks', () => {
      render(<BlockSelector {...defaultProps} />);
      
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should display label "Quadras Trabalhadas"', () => {
      render(<BlockSelector {...defaultProps} />);
      
      expect(screen.getByText('Quadras Trabalhadas')).toBeInTheDocument();
    });

    it('should display "Todas" and "Limpar" buttons', () => {
      render(<BlockSelector {...defaultProps} />);
      
      expect(screen.getByText('Todas')).toBeInTheDocument();
      expect(screen.getByText('Limpar')).toBeInTheDocument();
    });

    it('should display selection count', () => {
      render(<BlockSelector {...defaultProps} selectedBlocks={[1, 2]} />);
      
      expect(screen.getByText(/2 de 5 quadras selecionadas/)).toBeInTheDocument();
    });

    it('should display "✓ Todas" when all blocks selected', () => {
      render(<BlockSelector {...defaultProps} selectedBlocks={[1, 2, 3, 4, 5]} />);
      
      expect(screen.getByText('✓ Todas')).toBeInTheDocument();
    });

    it('should not display "✓ Todas" when some blocks are locked', () => {
      render(
        <BlockSelector 
          {...defaultProps} 
          selectedBlocks={[1, 2, 3, 4, 5]} 
          lockedBlocks={[1]}
        />
      );
      
      expect(screen.queryByText('✓ Todas')).not.toBeInTheDocument();
    });
  });

  describe('block selection', () => {
    it('should call onChange with block added when clicking unselected block', () => {
      const onChange = vi.fn();
      render(<BlockSelector {...defaultProps} onChange={onChange} />);
      
      fireEvent.click(screen.getByText('3'));
      
      expect(onChange).toHaveBeenCalledWith([3]);
    });

    it('should call onChange with block removed when clicking selected block', () => {
      const onChange = vi.fn();
      render(
        <BlockSelector 
          {...defaultProps} 
          selectedBlocks={[1, 2, 3]} 
          onChange={onChange} 
        />
      );
      
      // Selected blocks show checkmarks, find by button role
      const buttons = screen.getAllByRole('button');
      // Block 2 is the 3rd button (after Todas and Limpar)
      fireEvent.click(buttons[3]); // This is block 2
      
      expect(onChange).toHaveBeenCalledWith([1, 3]);
    });

    it('should maintain sorted order when adding blocks', () => {
      const onChange = vi.fn();
      render(
        <BlockSelector 
          {...defaultProps} 
          selectedBlocks={[1, 5]} 
          onChange={onChange} 
        />
      );
      
      fireEvent.click(screen.getByText('3'));
      
      expect(onChange).toHaveBeenCalledWith([1, 3, 5]);
    });
  });

  describe('select all functionality', () => {
    it('should select all blocks when clicking "Todas"', () => {
      const onChange = vi.fn();
      render(<BlockSelector {...defaultProps} onChange={onChange} />);
      
      fireEvent.click(screen.getByText('Todas'));
      
      expect(onChange).toHaveBeenCalledWith([1, 2, 3, 4, 5]);
    });

    it('should only select non-locked blocks when clicking "Todas"', () => {
      const onChange = vi.fn();
      render(
        <BlockSelector 
          {...defaultProps} 
          lockedBlocks={[2, 4]}
          onChange={onChange} 
        />
      );
      
      fireEvent.click(screen.getByText('Todas'));
      
      expect(onChange).toHaveBeenCalledWith([1, 3, 5]);
    });

    it('should not call onChange when disabled', () => {
      const onChange = vi.fn();
      render(<BlockSelector {...defaultProps} disabled onChange={onChange} />);
      
      fireEvent.click(screen.getByText('Todas'));
      
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('clear all functionality', () => {
    it('should clear all blocks when clicking "Limpar"', () => {
      const onChange = vi.fn();
      render(
        <BlockSelector 
          {...defaultProps} 
          selectedBlocks={[1, 2, 3]} 
          onChange={onChange} 
        />
      );
      
      fireEvent.click(screen.getByText('Limpar'));
      
      expect(onChange).toHaveBeenCalledWith([]);
    });

    it('should not call onChange when disabled', () => {
      const onChange = vi.fn();
      render(
        <BlockSelector 
          {...defaultProps} 
          selectedBlocks={[1, 2]} 
          disabled 
          onChange={onChange} 
        />
      );
      
      fireEvent.click(screen.getByText('Limpar'));
      
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('locked blocks', () => {
    it('should display locked block count', () => {
      render(
        <BlockSelector 
          {...defaultProps} 
          lockedBlocks={[1, 2]}
        />
      );
      
      expect(screen.getByText('2 bloqueadas')).toBeInTheDocument();
    });

    it('should not display locked count when no blocks locked', () => {
      render(<BlockSelector {...defaultProps} />);
      
      expect(screen.queryByText(/bloqueadas/)).not.toBeInTheDocument();
    });

    it('should not call onChange when clicking locked block', () => {
      const onChange = vi.fn();
      render(
        <BlockSelector 
          {...defaultProps} 
          lockedBlocks={[3]}
          onChange={onChange} 
        />
      );
      
      // Find the locked block button (it has a Lock icon)
      const buttons = screen.getAllByRole('button');
      // Block 3 is the 5th button (after Todas, Limpar, block 1, block 2)
      fireEvent.click(buttons[4]);
      
      expect(onChange).not.toHaveBeenCalled();
    });

    it('should disable locked block buttons', () => {
      render(
        <BlockSelector 
          {...defaultProps} 
          lockedBlocks={[2]}
        />
      );
      
      const buttons = screen.getAllByRole('button');
      // Block 2 is the 4th button
      expect(buttons[3]).toBeDisabled();
    });
  });

  describe('disabled state', () => {
    it('should disable all block buttons when disabled', () => {
      render(<BlockSelector {...defaultProps} disabled />);
      
      const buttons = screen.getAllByRole('button');
      // Skip Todas and Limpar buttons (first two)
      for (let i = 2; i < buttons.length; i++) {
        expect(buttons[i]).toBeDisabled();
      }
    });

    it('should disable "Todas" button when disabled', () => {
      render(<BlockSelector {...defaultProps} disabled />);
      
      expect(screen.getByText('Todas')).toBeDisabled();
    });

    it('should disable "Limpar" button when disabled', () => {
      render(<BlockSelector {...defaultProps} disabled />);
      
      expect(screen.getByText('Limpar')).toBeDisabled();
    });

    it('should not call onChange when clicking block while disabled', () => {
      const onChange = vi.fn();
      render(<BlockSelector {...defaultProps} disabled onChange={onChange} />);
      
      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[2]); // First block button
      
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle zero totalBlocks', () => {
      render(<BlockSelector {...defaultProps} totalBlocks={0} />);
      
      expect(screen.getByText('0 de 0 quadras selecionadas')).toBeInTheDocument();
    });

    it('should handle large number of blocks', () => {
      render(<BlockSelector {...defaultProps} totalBlocks={100} />);
      
      expect(screen.getByText('0 de 100 quadras selecionadas')).toBeInTheDocument();
    });

    it('should handle null lockedBlocks', () => {
      render(<BlockSelector {...defaultProps} lockedBlocks={null} />);
      
      // Should not crash and should render normally
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('should handle undefined lockedBlocks', () => {
      render(<BlockSelector {...defaultProps} lockedBlocks={undefined} />);
      
      // Should not crash and should render normally
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('should handle empty selectedBlocks', () => {
      render(<BlockSelector {...defaultProps} selectedBlocks={[]} />);
      
      expect(screen.getByText('0 de 5 quadras selecionadas')).toBeInTheDocument();
    });
  });

  describe('visual states', () => {
    it('should show check icon for selected blocks', () => {
      render(<BlockSelector {...defaultProps} selectedBlocks={[1]} />);
      
      // The block number should not be visible for selected blocks
      const buttons = screen.getAllByRole('button');
      // First block button (after Todas and Limpar)
      expect(buttons[2]).not.toHaveTextContent('1');
    });

    it('should show block number for unselected blocks', () => {
      render(<BlockSelector {...defaultProps} selectedBlocks={[]} />);
      
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  describe('selection count display', () => {
    it('should show correct count with no selection', () => {
      render(<BlockSelector {...defaultProps} selectedBlocks={[]} />);
      
      expect(screen.getByText('0 de 5 quadras selecionadas')).toBeInTheDocument();
    });

    it('should show correct count with partial selection', () => {
      render(<BlockSelector {...defaultProps} selectedBlocks={[1, 3, 5]} />);
      
      expect(screen.getByText('3 de 5 quadras selecionadas')).toBeInTheDocument();
    });

    it('should show correct count with full selection', () => {
      render(<BlockSelector {...defaultProps} selectedBlocks={[1, 2, 3, 4, 5]} />);
      
      expect(screen.getByText('5 de 5 quadras selecionadas')).toBeInTheDocument();
    });
  });
});
