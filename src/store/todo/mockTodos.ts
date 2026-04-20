import type { Todo } from '@/store/todo/types';

export const mockTodos: Todo[] = [
    {
        id: 'todo-1713596400000',
        title: 'Review onboarding copy',
        completed: false,
        createdAt: '2024-04-20T08:00:00.000Z',
        updatedAt: '2024-04-20T08:00:00.000Z'
    },
    {
        id: 'todo-1713600000000',
        title: 'Send sprint summary',
        completed: true,
        createdAt: '2024-04-20T09:00:00.000Z',
        updatedAt: '2024-04-20T10:30:00.000Z'
    },
    {
        id: 'todo-1713603600000',
        title: 'Book design review',
        completed: false,
        createdAt: '2024-04-20T10:00:00.000Z',
        updatedAt: '2024-04-20T10:00:00.000Z'
    }
];
