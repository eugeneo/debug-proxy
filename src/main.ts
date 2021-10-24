import { Chalk, whiteBright, cyan } from 'chalk';
import express, { Request, Response } from 'express';
import expressWs from 'express-ws';
import { padEnd } from 'lodash';
import { v4 } from 'uuid';
import WebSocket from 'ws';

const PORT = process.env.PORT || 3000;

interface ProtocolMessage {
    id: number;
    method: string;
    params: any;
}

function print(color: Chalk, tag: string, ...chunks: (string | number)[]) {
    process.stdout.write(`[${color(tag)}] ${chunks.join(' ')}\n`);
}

function printMessage(
    color: Chalk, prefix: string, { id, method, params }: ProtocolMessage,
) {
    print(
        color,
        prefix,
        id,
        whiteBright(padEnd(method, 17)),
        JSON.stringify(params),
    );
}

function respondWithJSON(object: unknown) {
    return (_req: Request, res: Response) => {
        res.json(object);
    };
}

async function initExpress() {
    const id = v4();
    const targetUrl = `localhost:${PORT}/targets/${id}`;
    const app = express();
    app.use(express.json());

    app.get('/json/version', respondWithJSON(
        { Browser: '@bore-all/proxy', 'Protocol-Version': '1.1' },
    ));

    app.get('/json/list', respondWithJSON([{
        description: 'node.js instance',
        devtoolsFrontendUrl:
            `devtools://devtools/bundled/js_app.html?experiments=true&v8only=true&ws=${targetUrl}`,
        devtoolsFrontendUrlCompat:
            `devtools://devtools/bundled/inspector.html?experiments=true&v8only=true&ws=${targetUrl}`,
        faviconUrl: 'https://nodejs.org/static/images/favicons/favicon.ico',
        id: '584b8297-fd03-438d-b7b5-38db423269db',
        title: 'Bore-All proxy',
        type: 'node',
        url: 'file://',
        webSocketDebuggerUrl: `ws://${targetUrl}`,
    }]));let pendingMessages = [] as string[];
    let client: WebSocket | null = null;

    expressWs(app).app
        .ws('/targets/:targetId', (ws, req) => {
            if (req.params.targetId !== id) {
                ws.close();
                return;
            }
            ws.on('message', (msg) => {
                printMessage(cyan, 'Frontend', JSON.parse(msg.toString()));
                if (!client) {
                    pendingMessages.push(msg);
                } else {
                    client.send(msg);
                }
            });
            ws.on('close', () => {
                print(cyan, id, 'disconnected');
            });
        })
        .ws('/client', (ws) => {
            client = ws;
            ws.on('message', (msg) => {
                printMessage(cyan, 'Backend', JSON.parse(msg.toString()));
            });
            ws.on('close', () => {
                print(cyan, id, 'disconnected');
            });
            pendingMessages.forEach((msg) => {
                ws.send(msg);
            });
            pendingMessages = [];
        });
    app.get('/', (req, res) => {
        res.send('Proxy is up');
    });

    app.listen(PORT, () => {
        console.log(`Example app listening on port ${PORT}!`);
    });
}

initExpress();
