import { render } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';

import {
    COLLECTION_STATES,
    resolveItemCount,
    TEXT_STATES,
    transformText
} from '@/test/contentStress';
import { StartGuideSection, type StartGuideItem } from '@/widgets/start-guide/StartGuideSection';

// `*ByRole` matches only accessibility elements (`accessible`, or an implicitly accessible host such as
// Text). The list container is deliberately NOT `accessible` — that would collapse every row into one
// announcement — so the role is read off the host tree instead.
const findListNodes = (container: TestInstance): TestInstance[] =>
    container.queryAll((node) => node.props['accessibilityRole'] === 'list');

const findGroupedRows = (container: TestInstance): TestInstance[] =>
    container.queryAll((node) => node.props['accessible'] === true);

const ITEMS: readonly StartGuideItem[] = [
    { id: 'prepare', code: 'npm run prepare', text: 'installs the git hooks' },
    { id: 'iterate', title: 'Iterate', text: 'per change, seconds' },
    { id: 'plain', text: 'a row with neither code nor title' }
];

const buildItems = (count: number, text: string): StartGuideItem[] =>
    Array.from({ length: count }, (_, index) => ({
        id: `item-${String(index)}`,
        code: `path/${String(index)}`,
        text
    }));

describe('StartGuideSection', () => {
    it('renders the header, every row part that is present, and the footer', async () => {
        const { getByText } = await render(
            <StartGuideSection
                title="Where to read"
                description="the brain files"
                items={ITEMS}
                footer="then the spec"
            />
        );

        expect(getByText('Where to read')).toBeTruthy();
        expect(getByText('the brain files')).toBeTruthy();
        expect(getByText('npm run prepare')).toBeTruthy();
        expect(getByText('installs the git hooks')).toBeTruthy();
        expect(getByText('Iterate')).toBeTruthy();
        expect(getByText('per change, seconds')).toBeTruthy();
        expect(getByText('a row with neither code nor title')).toBeTruthy();
        expect(getByText('then the spec')).toBeTruthy();
    });

    it('renders no description and no footer when the section has none', async () => {
        const { queryByText, getByText } = await render(
            <StartGuideSection title="First steps" items={ITEMS} />
        );

        expect(getByText('First steps')).toBeTruthy();
        expect(queryByText('the brain files')).toBeNull();
        expect(queryByText('then the spec')).toBeNull();
    });

    it('exposes the rows as one list and groups each row into one announcement', async () => {
        const { container } = await render(<StartGuideSection title="Agent flow" items={ITEMS} />);

        expect(findListNodes(container)).toHaveLength(1);
        expect(findGroupedRows(container)).toHaveLength(ITEMS.length);
    });

    it.each(COLLECTION_STATES)(
        'renders the %s collection state with a matching row count',
        async (state) => {
            const count = resolveItemCount(state);
            const { queryAllByText, container } = await render(
                <StartGuideSection title="What's inside" items={buildItems(count, 'row text')} />
            );

            expect(findListNodes(container)).toHaveLength(1);
            expect(findGroupedRows(container)).toHaveLength(count);
            expect(queryAllByText('row text')).toHaveLength(count);
        }
    );

    it.each(TEXT_STATES)('renders the %s text state without dropping the row', async (state) => {
        const text = transformText('installs the git hooks', state);
        const { getByText } = await render(
            <StartGuideSection title="First steps" items={buildItems(1, text)} />
        );

        expect(getByText(text)).toBeTruthy();
    });
});
