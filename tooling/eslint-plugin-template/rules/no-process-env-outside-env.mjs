const isIdentifierNamed = (node, name) => node?.type === 'Identifier' && node.name === name;

const isLiteralNamed = (node, value) => node?.type === 'Literal' && node.value === value;

const isDirectProcessEnv = (node) =>
    node?.type === 'MemberExpression' &&
    isIdentifierNamed(node.object, 'process') &&
    (isIdentifierNamed(node.property, 'env') || isLiteralNamed(node.property, 'env'));

const isProcessEnvAccess = (node) =>
    node?.type === 'MemberExpression' &&
    (isDirectProcessEnv(node) || isDirectProcessEnv(node.object));

export default {
    meta: {
        type: 'problem',
        docs: {
            description: 'disallow process.env access outside src/env.ts and tests'
        },
        schema: [],
        messages: {
            useEnvModule:
                'Read runtime configuration through `@/env` instead of accessing `process.env` directly.'
        }
    },
    create: (context) => ({
        MemberExpression: (node) => {
            if (!isProcessEnvAccess(node)) {
                return;
            }

            if (node.parent?.type === 'MemberExpression' && node.parent.object === node) {
                return;
            }

            context.report({
                node,
                messageId: 'useEnvModule'
            });
        }
    })
};
