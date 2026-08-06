import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as Dockable from '@hlorenzi/react-dockable';

// No-op ContentContext so panels that call ctx.setTitle() / ctx.layoutContent.panel
// don't crash when rendered outside a Dockable.Container.
// layoutPanel.rect tracks the actual OS window dimensions so canvas-based panels
// (e.g. Battlemap) can size themselves correctly.
const NOOP = () => {};

function makeContentContext(w, h, contentId) {
    return {
        layoutContent: {
            panel: { floating: true },
            layoutPanel: { rect: { x: 0, y: 0, w, h } },
            tabIndex: 0,
            content: contentId ? { contentId } : null,
        },
        setTitle: NOOP,
        setPreferredSize: NOOP,
    };
}

/**
 * Renders `children` into a real browser OS window via ReactDOM.createPortal.
 *
 * Because the portal stays in the same React tree, all contexts
 * (WebSocket, permissions, Chakra theme, game state) are fully available
 * inside the new window without any extra wiring.
 *
 * Props:
 *   children  – content to render in the new window
 *   title     – window title bar text
 *   onClose   – called when the OS window is closed by the user
 */
export const BrowserWindowPortal = ({ children, title = 'Panel', contentId, onClose }) => {
    const [windowRef, setWindowRef] = React.useState(null);
    const [mountNode, setMountNode] = React.useState(null);
    const [winSize, setWinSize] = React.useState({ w: 800, h: 600 });
    const observerRef = React.useRef(null);
    const closedByUs = React.useRef(false);

    React.useEffect(() => {
        const newWin = window.open(
            '',
            `nm_panel_${Date.now()}`,
            'width=800,height=600,menubar=no,toolbar=no,location=no,status=no'
        );

        if (!newWin) {
            console.error('[BrowserWindowPortal] window.open was blocked by the browser.');
            onClose?.();
            return;
        }

        // Write a minimal HTML skeleton so the document is ready to accept portals.
        newWin.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title></title></head><body style="margin:0;padding:0;width:100vw;height:100vh;overflow:hidden;background:#1e1e1e;"></body></html>`);
        newWin.document.close();
        newWin.document.title = title;


        // ── Copy <html> element attributes (Chakra theme, color-mode class) ───────
        const syncHtmlAttrs = () => {
            const srcHtml = document.documentElement;
            const dstHtml = newWin.document.documentElement;
            Array.from(srcHtml.attributes).forEach(attr => {
                dstHtml.setAttribute(attr.name, attr.value);
            });
        };
        syncHtmlAttrs();

        // Watch for attribute changes on the main <html> element (e.g. theme toggle)
        const htmlObserver = new MutationObserver(syncHtmlAttrs);
        htmlObserver.observe(document.documentElement, { attributes: true });

        // ── Copy all existing stylesheets ───────────────────────────────────────
        const copyStyles = (sourceDoc, targetDoc) => {
            // <link rel="stylesheet">
            Array.from(sourceDoc.querySelectorAll('link[rel="stylesheet"]')).forEach(link => {
                const newLink = targetDoc.createElement('link');
                newLink.rel = 'stylesheet';
                newLink.href = link.href;
                targetDoc.head.appendChild(newLink);
            });
            // <style> — inline styles, Chakra CSS variables, styled-components
            Array.from(sourceDoc.querySelectorAll('style')).forEach(style => {
                const newStyle = targetDoc.createElement('style');
                newStyle.textContent = style.textContent;
                targetDoc.head.appendChild(newStyle);
            });
        };

        copyStyles(document, newWin.document);

        // ── Sync future style injections ────────────────────────────────────────
        // Vite, styled-components, and Chakra all inject <style> tags dynamically.
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeName === 'STYLE') {
                        const newStyle = newWin.document.createElement('style');
                        newStyle.textContent = node.textContent;
                        newWin.document.head.appendChild(newStyle);
                    } else if (node.nodeName === 'LINK' && node.rel === 'stylesheet') {
                        const newLink = newWin.document.createElement('link');
                        newLink.rel = 'stylesheet';
                        newLink.href = node.href;
                        newWin.document.head.appendChild(newLink);
                    }
                });
            });
        });
        observer.observe(document.head, { childList: true });
        observerRef.current = observer;

        // ── Handle the OS window closing ────────────────────────────────────────
        const handleUnload = () => {
            if (!closedByUs.current) {
                onClose?.();
            }
        };
        newWin.addEventListener('beforeunload', handleUnload);

        setWindowRef(newWin);
        setMountNode(newWin.document.body);
        setWinSize({ w: newWin.innerWidth, h: newWin.innerHeight });

        return () => {
            observer.disconnect();
            htmlObserver.disconnect();
            newWin.removeEventListener('beforeunload', handleUnload);
            closedByUs.current = true;
            if (!newWin.closed) {
                // Show a "game disconnected" overlay instead of abruptly closing
                // (happens when the main app window is navigated away or closed)
                try {
                    const overlay = newWin.document.createElement('div');
                    overlay.style.cssText = [
                        'position:fixed', 'top:0', 'left:0', 'right:0', 'bottom:0',
                        'background:rgba(0,0,0,0.85)',
                        'display:flex', 'flex-direction:column',
                        'align-items:center', 'justify-content:center',
                        'z-index:99999',
                        'color:#fff', 'font-family:sans-serif', 'text-align:center',
                        'gap:12px',
                    ].join(';');
                    overlay.innerHTML = `
                        <div style="font-size:48px">⚠</div>
                        <div style="font-size:22px;font-weight:bold">Main game window closed</div>
                        <div style="font-size:14px;color:#aaa">The main game tab was closed or navigated away.<br/>You can close this window.</div>
                    `;
                    newWin.document.body.appendChild(overlay);
                } catch (_) {
                    newWin.close();
                }
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Track OS window resize so canvas panels (e.g. Battlemap) size correctly
    React.useEffect(() => {
        if (!windowRef) return;
        const handleResize = () => setWinSize({ w: windowRef.innerWidth, h: windowRef.innerHeight });
        windowRef.addEventListener('resize', handleResize);
        return () => windowRef.removeEventListener('resize', handleResize);
    }, [windowRef]);

    // Update window title when prop changes
    React.useEffect(() => {
        if (windowRef && !windowRef.closed) {
            windowRef.document.title = title;
        }
    }, [title, windowRef]);

    if (!mountNode) return null;

    return ReactDOM.createPortal(
        React.createElement(Dockable.ContentContext.Provider, { value: makeContentContext(winSize.w, winSize.h, contentId) },
            React.createElement('div', {
                style: { width: '100vw', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }
            }, children)
        ),
        mountNode
    );
};

export default BrowserWindowPortal;
