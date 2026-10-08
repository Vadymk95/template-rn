import { fireEvent, render, screen } from '@testing-library/react-native';

import { ErrorBoundary } from '@/shared/ui/ErrorBoundary/ErrorBoundary';
import { expectAccessibleControl } from '@/test/a11y';

describe('ErrorBoundary', () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(jest.fn());
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('renders fallback UI and logs the error', async () => {
        await render(<ErrorBoundary error={new Error('boom')} retry={jest.fn()} />);

        expect(screen.getByRole('alert')).toBeOnTheScreen();
        expect(screen.getByText(/something went wrong/i)).toBeOnTheScreen();
        expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('exposes the retry control with a button role and its text as the name', async () => {
        await expectAccessibleControl(
            <ErrorBoundary error={new Error('boom')} retry={jest.fn()} />,
            {
                role: 'button',
                name: 'Try again'
            }
        );
    });

    it('invokes retry when the button is pressed', async () => {
        const retry = jest.fn();
        await render(<ErrorBoundary error={new Error('boom')} retry={retry} />);

        await fireEvent.press(screen.getByRole('button'));
        expect(retry).toHaveBeenCalledTimes(1);
    });
});
