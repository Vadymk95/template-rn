const USER_COPY_PROP_NAMES = new Set([
    'label',
    'title',
    'subtitle',
    'description',
    'placeholder',
    'hint',
    'error',
    'helperText',
    'actionLabel',
    'accessibilityLabel',
    'submitLabel'
]);

const getStringValue = (attributeValue) => {
    if (!attributeValue) {
        return null;
    }

    if (attributeValue.type === 'Literal' && typeof attributeValue.value === 'string') {
        return attributeValue.value;
    }

    if (attributeValue.type !== 'JSXExpressionContainer') {
        return null;
    }

    const { expression } = attributeValue;

    if (expression.type === 'Literal' && typeof expression.value === 'string') {
        return expression.value;
    }

    if (expression.type === 'TemplateLiteral' && expression.expressions.length === 0) {
        return expression.quasis[0]?.value.cooked ?? null;
    }

    return null;
};

export default {
    meta: {
        type: 'problem',
        docs: {
            description: 'disallow raw user-visible string literals in JSX props'
        },
        schema: [],
        messages: {
            moveCopy:
                'Move user-visible copy to locale JSON and pass it through `t()` or a typed key helper instead of a raw string literal.'
        }
    },
    create: (context) => ({
        JSXAttribute: (node) => {
            if (node.name.type !== 'JSXIdentifier') {
                return;
            }

            if (!USER_COPY_PROP_NAMES.has(node.name.name)) {
                return;
            }

            const rawValue = getStringValue(node.value);
            if (rawValue === null || rawValue.trim() === '') {
                return;
            }

            context.report({
                node,
                messageId: 'moveCopy'
            });
        }
    })
};
