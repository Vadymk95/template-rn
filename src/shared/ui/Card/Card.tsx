import type { ReactElement, ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

import { cn } from '@/lib/utils';
import { RADII_TOKENS, SPACING_TOKENS } from '@/shared/lib/theme/tokens';

interface CardProps extends ViewProps {
    children: ReactNode;
    padded?: boolean;
    muted?: boolean;
}

export const Card = ({
    children,
    padded = true,
    muted = false,
    className,
    style,
    ...viewProps
}: CardProps): ReactElement => (
    <View
        className={cn('border', muted ? 'bg-muted' : 'bg-background', 'border-border', className)}
        style={[
            {
                borderRadius: RADII_TOKENS.xl,
                padding: padded ? SPACING_TOKENS.lg : 0
            },
            style
        ]}
        {...viewProps}
    >
        {children}
    </View>
);
