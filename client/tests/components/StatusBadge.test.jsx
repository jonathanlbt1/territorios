import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusBadge from '../../src/components/StatusBadge';

describe('StatusBadge', () => {
  describe('status type (default)', () => {
    it('should render "Pendente" for pending status', () => {
      render(<StatusBadge status="pending" />);
      
      expect(screen.getByText('Pendente')).toBeInTheDocument();
    });

    it('should render "Em Andamento" for in_progress status', () => {
      render(<StatusBadge status="in_progress" />);
      
      expect(screen.getByText('Em Andamento')).toBeInTheDocument();
    });

    it('should render "Devolvido" for returned status', () => {
      render(<StatusBadge status="returned" />);
      
      expect(screen.getByText('Devolvido')).toBeInTheDocument();
    });

    it('should render "Concluído" for completed status', () => {
      render(<StatusBadge status="completed" />);
      
      expect(screen.getByText('Concluído')).toBeInTheDocument();
    });

    it('should render "Cancelado" for cancelled status', () => {
      render(<StatusBadge status="cancelled" />);
      
      expect(screen.getByText('Cancelado')).toBeInTheDocument();
    });

    it('should apply status-badge class', () => {
      render(<StatusBadge status="pending" />);
      
      const badge = screen.getByText('Pendente');
      expect(badge).toHaveClass('status-badge');
    });

    it('should apply status-specific class', () => {
      render(<StatusBadge status="pending" />);
      
      const badge = screen.getByText('Pendente');
      expect(badge).toHaveClass('status-pending');
    });

    it('should apply correct class for in_progress', () => {
      render(<StatusBadge status="in_progress" />);
      
      const badge = screen.getByText('Em Andamento');
      expect(badge).toHaveClass('status-in_progress');
    });

    it('should apply correct class for returned', () => {
      render(<StatusBadge status="returned" />);
      
      const badge = screen.getByText('Devolvido');
      expect(badge).toHaveClass('status-returned');
    });

    it('should apply correct class for completed', () => {
      render(<StatusBadge status="completed" />);
      
      const badge = screen.getByText('Concluído');
      expect(badge).toHaveClass('status-completed');
    });

    it('should apply correct class for cancelled', () => {
      render(<StatusBadge status="cancelled" />);
      
      const badge = screen.getByText('Cancelado');
      expect(badge).toHaveClass('status-cancelled');
    });
  });

  describe('result type', () => {
    it('should render "Completo" for complete result', () => {
      render(<StatusBadge status="complete" type="result" />);
      
      expect(screen.getByText('Completo')).toBeInTheDocument();
    });

    it('should render "Parcial" for partial result', () => {
      render(<StatusBadge status="partial" type="result" />);
      
      expect(screen.getByText('Parcial')).toBeInTheDocument();
    });

    it('should render "Não Feito" for not_done result', () => {
      render(<StatusBadge status="not_done" type="result" />);
      
      expect(screen.getByText('Não Feito')).toBeInTheDocument();
    });

    it('should apply result-specific class for complete', () => {
      render(<StatusBadge status="complete" type="result" />);
      
      const badge = screen.getByText('Completo');
      expect(badge).toHaveClass('result-complete');
    });

    it('should apply result-specific class for partial', () => {
      render(<StatusBadge status="partial" type="result" />);
      
      const badge = screen.getByText('Parcial');
      expect(badge).toHaveClass('result-partial');
    });

    it('should apply result-specific class for not_done', () => {
      render(<StatusBadge status="not_done" type="result" />);
      
      const badge = screen.getByText('Não Feito');
      expect(badge).toHaveClass('result-not_done');
    });

    it('should still have status-badge class', () => {
      render(<StatusBadge status="complete" type="result" />);
      
      const badge = screen.getByText('Completo');
      expect(badge).toHaveClass('status-badge');
    });
  });

  describe('unknown status fallback', () => {
    it('should render raw status when not found in labels', () => {
      render(<StatusBadge status="unknown_status" />);
      
      expect(screen.getByText('unknown_status')).toBeInTheDocument();
    });

    it('should apply class for unknown status', () => {
      render(<StatusBadge status="custom" />);
      
      const badge = screen.getByText('custom');
      expect(badge).toHaveClass('status-custom');
    });

    it('should render raw result when not found in result labels', () => {
      render(<StatusBadge status="unknown_result" type="result" />);
      
      expect(screen.getByText('unknown_result')).toBeInTheDocument();
    });

    it('should apply class for unknown result', () => {
      render(<StatusBadge status="custom_result" type="result" />);
      
      const badge = screen.getByText('custom_result');
      expect(badge).toHaveClass('result-custom_result');
    });
  });

  describe('type prop default', () => {
    it('should default to status type when type not provided', () => {
      render(<StatusBadge status="pending" />);
      
      const badge = screen.getByText('Pendente');
      expect(badge).toHaveClass('status-pending');
      expect(badge).not.toHaveClass('result-pending');
    });

    it('should use status labels by default', () => {
      render(<StatusBadge status="completed" />);
      
      // Should show "Concluído" (status label), not "completed"
      expect(screen.getByText('Concluído')).toBeInTheDocument();
    });
  });

  describe('element structure', () => {
    it('should render as a span element', () => {
      const { container } = render(<StatusBadge status="pending" />);
      
      const span = container.querySelector('span');
      expect(span).toBeInTheDocument();
      expect(span).toHaveTextContent('Pendente');
    });

    it('should have exactly two classes', () => {
      render(<StatusBadge status="pending" />);
      
      const badge = screen.getByText('Pendente');
      expect(badge.classList.length).toBe(2);
    });
  });

  describe('Portuguese labels', () => {
    it('should display all status labels in Portuguese', () => {
      const { rerender } = render(<StatusBadge status="pending" />);
      expect(screen.getByText('Pendente')).toBeInTheDocument();
      
      rerender(<StatusBadge status="in_progress" />);
      expect(screen.getByText('Em Andamento')).toBeInTheDocument();
      
      rerender(<StatusBadge status="returned" />);
      expect(screen.getByText('Devolvido')).toBeInTheDocument();
      
      rerender(<StatusBadge status="completed" />);
      expect(screen.getByText('Concluído')).toBeInTheDocument();
      
      rerender(<StatusBadge status="cancelled" />);
      expect(screen.getByText('Cancelado')).toBeInTheDocument();
    });

    it('should display all result labels in Portuguese', () => {
      const { rerender } = render(<StatusBadge status="complete" type="result" />);
      expect(screen.getByText('Completo')).toBeInTheDocument();
      
      rerender(<StatusBadge status="partial" type="result" />);
      expect(screen.getByText('Parcial')).toBeInTheDocument();
      
      rerender(<StatusBadge status="not_done" type="result" />);
      expect(screen.getByText('Não Feito')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle empty string status', () => {
      render(<StatusBadge status="" />);
      
      const badge = document.querySelector('.status-badge');
      expect(badge).toBeInTheDocument();
    });

    it('should handle status with special characters in class', () => {
      render(<StatusBadge status="test-status" />);
      
      const badge = screen.getByText('test-status');
      expect(badge).toHaveClass('status-test-status');
    });

    it('should handle numeric-like status', () => {
      render(<StatusBadge status="123" />);
      
      expect(screen.getByText('123')).toBeInTheDocument();
    });

    it('should handle status type with result value', () => {
      // Using a result value with status type should fall back to raw value
      render(<StatusBadge status="complete" type="status" />);
      
      expect(screen.getByText('complete')).toBeInTheDocument();
    });

    it('should handle result type with status value', () => {
      // Using a status value with result type should fall back to raw value
      render(<StatusBadge status="pending" type="result" />);
      
      expect(screen.getByText('pending')).toBeInTheDocument();
    });
  });
});
