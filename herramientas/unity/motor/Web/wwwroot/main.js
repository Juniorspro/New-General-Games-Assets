import { dotnet } from './_framework/dotnet.js'
const { getConfig } = await dotnet.withDiagnosticTracing(false).create();
await dotnet.run();
