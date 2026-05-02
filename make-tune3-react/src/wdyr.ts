import React from 'react';
import whyDidYouRender from '@welldone-software/why-did-you-render';

/// <reference types="vite/client" />

if (import.meta.env.DEV) {
    whyDidYouRender(React, {
        trackAllPureComponents: false,
        trackHooks: true,
    });
}
