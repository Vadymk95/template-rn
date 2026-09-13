import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { SPACING_TOKENS, TYPOGRAPHY_TOKENS } from '@/shared/lib/theme/tokens';
import { Screen } from '@/shared/ui/Screen/Screen';
import { ScreenHeader } from '@/shared/ui/ScreenHeader/ScreenHeader';
import {
    START_GUIDE_CODE_CLASS_NAME,
    START_GUIDE_COMMANDS,
    START_GUIDE_COPY_KEYS,
    START_GUIDE_ENTRY_PATHS,
    START_GUIDE_FLOW,
    START_GUIDE_INSIDE,
    START_GUIDE_NAMESPACE,
    START_GUIDE_READING,
    START_GUIDE_STEPS
} from '@/widgets/start-guide/constants';
import { StartGuideSection } from '@/widgets/start-guide/StartGuideSection';

export const StartGuideScreen = (): ReactElement => {
    const { t } = useTranslation(START_GUIDE_NAMESPACE);

    const insideItems = START_GUIDE_INSIDE.map(({ id, code, copyKey }) => ({
        id,
        code,
        text: t(copyKey)
    }));
    const flowItems = START_GUIDE_FLOW.map(({ id, titleKey, copyKey }) => ({
        id,
        title: t(titleKey),
        text: t(copyKey)
    }));
    const commandItems = START_GUIDE_COMMANDS.map(({ id, code, copyKey }) => ({
        id,
        code,
        text: t(copyKey)
    }));
    const readingItems = START_GUIDE_READING.map(({ id, code, copyKey }) => ({
        id,
        code,
        text: t(copyKey)
    }));
    const stepItems = START_GUIDE_STEPS.map(({ id, code, copyKey }) => ({
        id,
        code,
        text: t(copyKey)
    }));

    return (
        <Screen scrollable>
            <View style={{ gap: SPACING_TOKENS['2xl'] }}>
                <View style={{ gap: SPACING_TOKENS.md }}>
                    <ScreenHeader
                        title={t(START_GUIDE_COPY_KEYS.title)}
                        subtitle={t(START_GUIDE_COPY_KEYS.description)}
                    />
                    <Text className={TYPOGRAPHY_TOKENS.bodyMuted}>
                        {t(START_GUIDE_COPY_KEYS.seed)}
                    </Text>
                    <View className="flex-row flex-wrap" style={{ gap: SPACING_TOKENS.sm }}>
                        {START_GUIDE_ENTRY_PATHS.map((path) => (
                            <Text key={path} className={START_GUIDE_CODE_CLASS_NAME}>
                                {path}
                            </Text>
                        ))}
                    </View>
                </View>
                <StartGuideSection
                    title={t(START_GUIDE_COPY_KEYS.inside.title)}
                    items={insideItems}
                />
                <StartGuideSection title={t(START_GUIDE_COPY_KEYS.flow.title)} items={flowItems} />
                <StartGuideSection
                    title={t(START_GUIDE_COPY_KEYS.agents.title)}
                    description={t(START_GUIDE_COPY_KEYS.agents.lead)}
                    items={commandItems}
                    footer={t(START_GUIDE_COPY_KEYS.agents.spec)}
                />
                <StartGuideSection
                    title={t(START_GUIDE_COPY_KEYS.reading.title)}
                    items={readingItems}
                />
                <StartGuideSection title={t(START_GUIDE_COPY_KEYS.steps.title)} items={stepItems} />
            </View>
        </Screen>
    );
};
