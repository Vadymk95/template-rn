export const createTodoId = (timestamp: number, collisionIndex = 0): string => {
    const baseId = `todo-${String(timestamp)}`;

    if (collisionIndex === 0) {
        return baseId;
    }

    return `${baseId}-${String(collisionIndex)}`;
};
