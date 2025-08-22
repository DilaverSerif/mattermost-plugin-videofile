import React from 'react';
import axios from 'axios';
import { renderToStaticMarkup } from 'react-dom/server';

class PluginSettings {
    constructor(data) {
        /**
         * @type {number}
         */
        this.maxHeight = data.maxHeight == null ? 350 : data.maxHeight;
        /**
         * @type {number}
         */
        this.renderTimeout = data.renderTimeout == null ? 20 : data.renderTimeout;
        /**
         * @type {boolean}
         */
        this.mp4 = data.mp4 == null ? true : data.mp4;
        /**
         * @type {boolean}
         */
        this.webm = data.webm == null ? true : data.webm;
        /**
         * @type {boolean}
         */
        this.mov = data.mov == null ? true : data.mov;
        /**
         * @type {boolean}
         */
        this.avi = data.avi == null ? true : data.avi;
        /**
         * @type {boolean}
         */
        this.wmv = data.wmv == null ? true : data.wmv;
        /**
         * @type {boolean}
         */
        this.ogv = data.ogv == null ? true : data.ogv;
        /**
         * @type {string[]}
         */
        this.supportedFileTypes = [
            'mp4',
            'webm',
            'mov',
            'avi',
            'wmv',
            'ogv'
        ];
    }
}


class PostMessageAttachmentComponent extends React.Component {
    static plugin;
    /**
     * @type {PluginSettings}
     */
    static settings;

    constructor(props) {
        super(props);
        this.postId = props.postId;
        this.msg = null;
        this.fileType = null;
        this.fileUrl = null;
        this.customId = null;
        this.rootRef = React.createRef();
        this._didInject = false;
        this._timer = null;
        this.postMessageId = this.postId + '_message';
        /**
         * @type {PluginSettings}
         */
        this.settings = PostMessageAttachmentComponent.settings;
    }

    render() {
        // Render a lightweight, layout-neutral root so we can scope DOM queries to the correct pane (center/RHS).
        return (<div ref={this.rootRef} data-videofile-root="true" style={{display: 'contents'}} />);
    }

    componentDidMount() {
        this._scheduleAfterRender();
    }

    componentDidUpdate() {
        this._scheduleAfterRender();
    }

    componentWillUnmount() {
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }
    }

    _scheduleAfterRender() {
        if (this._timer) {
            clearTimeout(this._timer);
        }
        this._timer = setTimeout(() => {
            this.afterRender();
            this._timer = null;
        }, this.settings.renderTimeout);
    }

    /**
     * @returns {boolean}
     */
    isFilePostMessage() {
        if (this.msg.getElementsByClassName('post-image__details')[0] == null) {
            return false;
        }
        return true;
    }

    /**
     * @returns {string}
     */
    getFileType() {
        return this.msg.getElementsByClassName('post-image__type')[0]
            .innerHTML.toLowerCase().trim();
    }

    /**
     * @returns {boolean}
     */
    isRendered() {
        const parent = this.msg.parentElement;
        // Ensure a stable id per attachment by using the file URL when available.
        if (!this.customId && this.fileUrl) {
            // Use a simple hash substitute by base64 of the URL to keep ids DOM-safe.
            try {
                this.customId = `${this.postId}_custom_${btoa(unescape(encodeURIComponent(this.fileUrl))).replace(/[^a-zA-Z0-9_-]/g, '')}_video_container`;
            } catch {
                this.customId = this.postId + `_custom_${this.fileType}_video_container`;
            }
        } else if (!this.customId) {
            this.customId = this.postId + `_custom_${this.fileType}_video_container`;
        }
        
        // Check if video player already exists anywhere in the parent element
        const existingPlayer = parent.querySelector(`#${this.customId}`);
        if (existingPlayer) {
            return true;
        }
        
        // Check for existing video players with the same post ID
        const existingPostPlayers = parent.querySelectorAll(`[data-videofile-post-id="${this.postId}"]`);
        if (existingPostPlayers.length > 0) {
            return true;
        }
        
        // Also check if any video element with the same source already exists
        const videoElements = parent.querySelectorAll('video');
        for (const video of videoElements) {
            const source = video.querySelector('source');
            if (source && source.src === this.fileUrl) {
                return true;
            }
            // Check data attribute as well
            if (video.getAttribute('data-videofile-source') === this.fileUrl) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Remove duplicate players with the same URL within the same parent container, keeping the first.
     * @param {HTMLElement} parent
     */
    cleanupDuplicates(parent) {
        try {
            const nodes = parent.querySelectorAll(`[data-videofile-post-id="${this.postId}"][data-videofile-url="${this.fileUrl}"]`);
            if (nodes.length <= 1) {
                return;
            }
            // Keep the first, remove the rest
            for (let i = 1; i < nodes.length; i++) {
                nodes[i].remove();
            }
        } catch {}
    }

    /**
     * @returns {string}
     */
    getFileUrl() {
        const a = this.msg.getElementsByTagName('a')[1];
        return a.href.replace('?download=1', '');
    }

    /**
     * @returns {HTMLDivElement}
     */
    getHtmlVideoElement() {
        let maxHeight = this.settings.maxHeight;
        try {
            if (PostMessageAttachmentComponent.plugin.props.maxHeight != null && maxHeight == null) {
                maxHeight = PostMessageAttachmentComponent.plugin.props.maxHeight;
            }
        } catch {
        }
        const css = `
                    .videofile-mh {
                        max-height: ${maxHeight}px;
                    }`;
        const node = document.createElement('div');
        node.setAttribute('id', this.customId);
        node.setAttribute('data-videofile-post-id', this.postId);
        node.setAttribute('data-videofile-url', this.fileUrl);

        const fileType = this.getVideoUrlType(this.fileUrl);

        const html =
            <>
                <style>{css}</style>
                <video controls="true" class="videofile-mh" data-videofile-source={this.fileUrl}>
                    <source src={this.fileUrl} type={fileType} />
                </video>
            </>;
        node.innerHTML = renderToStaticMarkup(html);
        return node;
    }

    /**
    * 
    * @param {string} url 
    * @returns {string}
    */
    getVideoUrlType(url) {
        try {
            const split = url.split('.');
            switch (split[split.length - 1]) {
                case 'webm':
                    return 'video/webm';

                case 'mov':
                    return 'video/quicktime';

                case 'avi':
                    return 'video/x-msvideo';

                case 'wmv':
                    return 'video/x-ms-wmv';

                case 'ogv':
                    return 'video/ogv';

                case 'mp4':
                    return 'video/mp4';
            }
        } catch {
            return 'video/mp4';
        }
    }

    /**
     * @returns void
     */
    afterRender() {
        /**
         * @type HTMLDivElement
         */
        // Prefer scoping to the nearest matching node within this component's subtree (fixes duplication between panes).
        try {
            const root = this.rootRef && this.rootRef.current ? this.rootRef.current : null;
            if (root) {
                // Find the closest message body for this post inside the same pane (center/RHS)
                this.msg = root.closest(`#${this.postMessageId}`) || null;
            }
        } catch {}
        // Fallback for older layouts if not found within scope
        if (!this.msg) {
            this.msg = document.getElementById(this.postMessageId);
        }
        try {
            if (!this.isFilePostMessage()) {
                return;
            }
            // Prevent double injection from the same component instance.
            if (this._didInject) {
                return;
            }
            this.fileType = this.getFileType();
            if (!this.settings.supportedFileTypes.includes(this.fileType)) {
                return;
            }
            for (const ft of this.settings.supportedFileTypes) {
                if (this.fileType == ft && !this.settings[ft]) {
                    return;
                }
            }
            
            // Get file URL early so we can use it in isRendered check
            this.fileUrl = this.getFileUrl();
            
            if (this.isRendered()) {
                // If rendered, ensure there's only one instance
                this.cleanupDuplicates(this.msg.parentElement);
                return;
            }
            
            this.msg.parentElement.append(this.getHtmlVideoElement());
            this._didInject = true;
        } catch (err) {
            console.log('VideoFile plugin error:', err);
        }
    }

}


class VideoFilePlugin {
    static apiUrl = '/plugins/videofile';

    initialize(registry, store) {
        const plugin = store.getState().plugins.plugins.videofile;
        PostMessageAttachmentComponent.plugin = plugin;
        axios.get(`${VideoFilePlugin.apiUrl}/settings`)
            .then(res => {
                /**
                 * @type {PluginSettings}
                 */
                const settings = new PluginSettings(res.data);
                PostMessageAttachmentComponent.settings = settings;
                registry.registerPostMessageAttachmentComponent(
                    PostMessageAttachmentComponent
                );
            })
            .catch(err => {
                /**
                 * @type {PluginSettings}
                 */
                const settings = new PluginSettings();
                PostMessageAttachmentComponent.settings = settings;
                registry.registerPostMessageAttachmentComponent(
                    PostMessageAttachmentComponent
                );
            });
    }

    uninitialize() {
        // No clean up required.
    }
}

window.registerPlugin('videofile', new VideoFilePlugin());