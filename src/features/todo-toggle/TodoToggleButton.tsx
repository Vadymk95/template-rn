import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { TODO_COPY_KEYS, TODO_NAMESPACE, getTodoActionLabel } from '@/features/todo/constants';
import { IconButton } from '@/shared/ui/IconButton/IconButton';

interface TodoToggleButtonProps {
    completed: boolean;
    todoTitle: string;
    onPress: () => void;
    testID?: string;
}

export const TodoToggleButton = ({
    completed,
    todoTitle,
    onPress,
    testID
}: TodoToggleButtonProps): ReactElement => {
    const { t } = useTranslation(TODO_NAMESPACE);

    return (
        <IconButton
            icon={completed ? 'checkmark-circle' : 'ellipse-outline'}
            accessibilityLabel={getTodoActionLabel(
                todoTitle,
                t(
                    completed
                        ? TODO_COPY_KEYS.actions.markActive
                        : TODO_COPY_KEYS.actions.markComplete
                )
            )}
            accessibilityState={{
                selected: completed
            }}
            testID={testID}
            onPress={onPress}
        />
    );
};
