import { useEffect, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { TODO_COPY_KEYS, TODO_NAMESPACE } from '@/features/todo/constants';
import { SPACING_TOKENS } from '@/shared/lib/theme/tokens';
import { Button } from '@/shared/ui/Button/Button';
import { Input } from '@/shared/ui/Input/Input';

interface TodoFormProps {
    initialTitle: string;
    submitLabel: string;
    onSubmit: (title: string) => void;
    onCancel: () => void;
}

export const TodoForm = ({
    initialTitle,
    submitLabel,
    onSubmit,
    onCancel
}: TodoFormProps): ReactElement => {
    const { t } = useTranslation(TODO_NAMESPACE);
    const [title, setTitle] = useState(initialTitle);
    const [error, setError] = useState<string | undefined>();

    useEffect(() => {
        setTitle(initialTitle);
        setError(undefined);
    }, [initialTitle]);

    const handleSubmit = (): void => {
        const normalizedTitle = title.trim();

        if (!normalizedTitle) {
            setError(t(TODO_COPY_KEYS.form.titleRequired));
            return;
        }

        setError(undefined);
        onSubmit(normalizedTitle);
    };

    return (
        <View style={{ gap: SPACING_TOKENS.lg }}>
            <Input
                autoFocus
                label={t(TODO_COPY_KEYS.form.titleLabel)}
                hint={t(TODO_COPY_KEYS.form.titleHint)}
                value={title}
                placeholder={t(TODO_COPY_KEYS.form.titlePlaceholder)}
                {...(error ? { error } : {})}
                onChangeText={(nextTitle) => {
                    setTitle(nextTitle);
                    if (error) {
                        setError(undefined);
                    }
                }}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
            />
            <View
                className="flex-row justify-end"
                style={{
                    gap: SPACING_TOKENS.sm
                }}
            >
                <Button
                    label={t(TODO_COPY_KEYS.actions.cancel)}
                    variant="secondary"
                    onPress={onCancel}
                />
                <Button label={submitLabel} onPress={handleSubmit} />
            </View>
        </View>
    );
};
