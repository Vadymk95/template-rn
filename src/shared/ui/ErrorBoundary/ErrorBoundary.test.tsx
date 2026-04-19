import { fireEvent, render, screen } from '@testing-library/react-native';

import { ErrorBoundary } from '@/shared/ui/ErrorBoundary/ErrorBoundary';

describe('ErrorBoundary', () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(jest.fn());
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('renders fallback UI and logs the error', () => {
        render(<ErrorBoundary error={new Error('boom')} retry={jest.fn()} />);

        expect(screen.getByRole('alert')).toBeOnTheScreen();
        expect(screen.getByText(/something went wrong/i)).toBeOnTheScreen();
        expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('invokes retry when the button is pressed', () => {
        const retry = jest.fn();
        render(<ErrorBoundary error={new Error('boom')} retry={retry} />);

        fireEvent.press(screen.getByRole('button'));
        expect(retry).toHaveBeenCalledTimes(1);
    });
});
