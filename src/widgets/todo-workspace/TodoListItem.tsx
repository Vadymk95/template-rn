import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { TODO_COPY_KEYS, TODO_NAMESPACE, getTodoActionLabel } from '@/features/todo/constants';
import type { TodoItemModel } from '@/features/todo/types';
import { TodoDeleteButton } from '@/features/todo-delete/TodoDeleteButton';
import { TodoToggleButton } from '@/features/todo-toggle/TodoToggleButton';
import { SPACING_TOKENS, TYPOGRAPHY_TOKENS } from '@/shared/lib/theme/tokens';
import { Button } from '@/shared/ui/Button/Button';
import { Card } from '@/shared/ui/Card/Card';

/** A summary row shows two lines of title; the rest is ellipsised. */
const TODO_TITLE_MAX_LINES = 2;

interface TodoListItemProps {
    todo: TodoItemModel;
    onEditTodo: (todo: TodoItemModel) => void;
    onToggleTodo: (id: string) => void;
    onDeleteTodo: (id: string) => void;
}

export const TodoListItem = ({
    todo,
    onEditTodo,
    onToggleTodo,
    onDeleteTodo
}: TodoListItemProps): ReactElement => {
    const { t } = useTranslation(TODO_NAMESPACE);

    return (
        <Card
            testID={`todo-item-${todo.id}`}
            style={{
                gap: SPACING_TOKENS.md
            }}
        >
            <View
                className="flex-row items-start"
                style={{
                    gap: SPACING_TOKENS.md
                }}
            >
                <TodoToggleButton
                    completed={todo.completed}
                    todoTitle={todo.title}
                    testID={`todo-toggle-${todo.id}`}
                    onPress={() => {
                        onToggleTodo(todo.id);
                    }}
                />
                <View
                    className="flex-1"
                    style={{
                        gap: SPACING_TOKENS.xs
                    }}
                >
                    <Text
                        className={[
                            TYPOGRAPHY_TOKENS.sectionTitle,
                            todo.completed
                                ? 'text-muted-foreground line-through'
                                : 'text-foreground'
                        ].join(' ')}
                        /*
                         * A summary row, so the title is capped and ellipsised rather than allowed to
                         * grow the card without bound. Nothing in this app limited title length, so a
                         * long or unbroken one pushed every following row off the screen. The full text
                         * is still reachable — the edit dialog shows it in a field.
                         */
                        numberOfLines={TODO_TITLE_MAX_LINES}
                        ellipsizeMode="tail"
                    >
                        {todo.title}
                    </Text>
                    <Text className={TYPOGRAPHY_TOKENS.caption}>
                        {todo.completed
                            ? t(TODO_COPY_KEYS.status.completed)
                            : t(TODO_COPY_KEYS.status.active)}
                    </Text>
                </View>
                <TodoDeleteButton
                    todoTitle={todo.title}
                    onPress={() => {
                        onDeleteTodo(todo.id);
                    }}
                />
            </View>
            <View
                className="flex-row justify-end"
                style={{
                    gap: SPACING_TOKENS.sm
                }}
            >
                <Button
                    label={t(TODO_COPY_KEYS.actions.edit)}
                    variant="secondary"
                    size="sm"
                    accessibilityLabel={getTodoActionLabel(
                        todo.title,
                        t(TODO_COPY_KEYS.actions.edit)
                    )}
                    onPress={() => {
                        onEditTodo(todo);
                    }}
                />
            </View>
        </Card>
    );
};
