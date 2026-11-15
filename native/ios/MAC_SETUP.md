# Stormpad iOS — Mac setup (widget + App Group)

O projeto Capacitor (`ios/`) já existe. No **Mac** com Xcode e conta Apple Developer:

## 1. Sync e abrir

```bash
npm install
npm run cap:sync
npm run cap:open
```

## 2. App Group

1. No target **App**, Signing & Capabilities → **+ Capability** → **App Groups**.
2. Ative `group.com.ezdussin.stormpad` (já referenciado em `App/App.entitlements`).
3. No portal Apple Developer, crie o mesmo App Group se ainda não existir.

## 3. Extensão WidgetKit

Os fontes estão em [`ios/StormpadMemoriesWidget/`](../../ios/StormpadMemoriesWidget/).

1. File → New → Target → **Widget Extension**.
2. Product Name: `StormpadMemoriesWidget`, bundle id: `com.ezdussin.stormpad.StormpadMemoriesWidget`.
3. Desmarque “Include Configuration App Intent” se o Xcode oferecer.
4. Remova os arquivos gerados pelo template e adicione (ou substitua por) os arquivos desta pasta:
   - `SharedModels.swift`
   - `MemoryIntents.swift`
   - `StormpadMemoriesWidget.swift`
   - `StormpadMemoriesWidgetBundle.swift`
   - `Info.plist`
   - `StormpadMemoriesWidget.entitlements`
5. No target do widget: Signing & Capabilities → App Groups → `group.com.ezdussin.stormpad`.
6. Em Build Settings do widget: `CODE_SIGN_ENTITLEMENTS` = `../StormpadMemoriesWidget/StormpadMemoriesWidget.entitlements` (ajuste o path conforme a pasta do target).
7. Deployment target ≥ **17.0** no widget (botões anterior/próxima usam App Intents). O app pode ficar em 15+.

## 4. Deep link

O scheme `stormpad://` já está em `App/Info.plist`. Toque no widget abre `stormpad://memories` ou `stormpad://memories?id=…`.

## 5. Instalar no iPhone

Selecione o scheme **App**, seu device, Run. Depois: tela inicial → Editar → widgets → **Lembranças**.

## Plugin nativo

`@stormpad/widget-bridge` grava o JSON das lembranças no App Group e chama `WidgetCenter.reloadAllTimelines()`. É sincronizado automaticamente pelo `cap sync`.
