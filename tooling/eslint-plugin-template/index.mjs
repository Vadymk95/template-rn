import noProcessEnvOutsideEnv from './rules/no-process-env-outside-env.mjs';
import noUserCopyLiterals from './rules/no-user-copy-literals.mjs';

export default {
    meta: {
        name: 'eslint-plugin-template'
    },
    rules: {
        'no-process-env-outside-env': noProcessEnvOutsideEnv,
        'no-user-copy-literals': noUserCopyLiterals
    }
};
