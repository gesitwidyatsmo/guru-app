/**
 * Unit tests for Modal component
 */

import { render, screen, fireEvent } from '@testing-library/react';
import Modal from '@/app/components/Modal';

describe('Modal Component', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  it('should render when open is true', () => {
    render(
      <Modal open={true} onClose={mockOnClose} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    );

    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Modal Content')).toBeInTheDocument();
  });

  it('should not render when open is false', () => {
    const { container } = render(
      <Modal open={false} onClose={mockOnClose} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    );

    expect(container.firstChild).toBeNull();
  });

  it('should call onClose when close button is clicked', () => {
    render(
      <Modal open={true} onClose={mockOnClose} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    );

    const closeButton = screen.getByRole('button');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when overlay is clicked', () => {
    render(
      <Modal open={true} onClose={mockOnClose} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    );

    // Click the overlay (the outer div)
    const overlay = screen.getByText('Test Modal').closest('div').parentElement.parentElement;
    fireEvent.click(overlay);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should render children correctly', () => {
    render(
      <Modal open={true} onClose={mockOnClose} title="Test Modal">
        <button>Action Button</button>
        <p>Description text</p>
      </Modal>
    );

    expect(screen.getByRole('button', { name: /action button/i })).toBeInTheDocument();
    expect(screen.getByText('Description text')).toBeInTheDocument();
  });
});
