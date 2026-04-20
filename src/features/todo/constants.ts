import { TODO_FILTERS } from '@/store/todo/constants';

export const TODO_ALL_FILTER_ID = TODO_FILTERS.all;
export const TODO_NAMESPACE = 'todo';

export const TODO_COPY_KEYS = {
    actions: {
        create: 'actions.create',
        createSubmit: 'actions.createSubmit',
        saveSubmit: 'actions.saveSubmit',
        cancel: 'actions.cancel',
        edit: 'actions.edit',
        delete: 'actions.delete',
        markComplete: 'actions.markComplete',
        markActive: 'actions.markActive'
    },
    dialogs: {
        createTitle: 'dialogs.create.title',
        createDescription: 'dialogs.create.description',
        editTitle: 'dialogs.edit.title',
        editDescription: 'dialogs.edit.description'
    },
    form: {
        titleLabel: 'form.titleLabel',
        titlePlaceholder: 'form.titlePlaceholder',
        titleHint: 'form.titleHint',
        titleRequired: 'form.titleRequired'
    },
    summary: {
        total: 'summary.total',
        active: 'summary.active',
        completed: 'summary.completed'
    },
    filters: {
        all: 'filters.all',
        active: 'filters.active',
        completed: 'filters.completed'
    },
    list: {
        sectionTitle: 'list.sectionTitle',
        emptyAllTitle: 'list.emptyAllTitle',
        emptyAllDescription: 'list.emptyAllDescription',
        emptyFilteredTitle: 'list.emptyFilteredTitle',
        emptyFilteredDescription: 'list.emptyFilteredDescription'
    },
    status: {
        completed: 'status.completed',
        active: 'status.active'
    }
} as const;

const formatTodoActionLabel = (actionLabel: string, todoTitle: string): string =>
    `${actionLabel} for ${todoTitle}`;

export const getTodoActionLabel = (todoTitle: string, actionLabel: string): string =>
    formatTodoActionLabel(actionLabel, todoTitle);

export const TODO_FILTER_OPTIONS = [
    {
        id: TODO_FILTERS.all,
        labelKey: TODO_COPY_KEYS.filters.all
    },
    {
        id: TODO_FILTERS.active,
        labelKey: TODO_COPY_KEYS.filters.active
    },
    {
        id: TODO_FILTERS.completed,
        labelKey: TODO_COPY_KEYS.filters.completed
    }
] as const;
