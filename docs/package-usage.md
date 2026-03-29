# Package logging via `.env` (logs-gateway)

**Canonical contract** for npm packages that emit diagnostics through **[logs-gateway](https://www.npmjs.com/package/logs-gateway)**.

- **Per package:** only **logs level** is configured with that package’s **package prefix** on the variable name.
- **Cross-cutting (once per app / process):** where logs go (console, file, unified, …) and **format** are **not** repeated per package—they are shared for the whole host. Downstream wiring implements that split; this doc defines the **package-level** part only.

**Default when neither `<packagePrefix>_LOGS_LEVEL` nor `<packagePrefix>_LOG_LEVEL` is set in the environment:** **`warn`** (emit **`warn`** and **`error`** only). To silence a package, set **`off`** (or synonyms **`none`** / **`silent`**). To see **`info`**, **`debug`**, or **`verbose`**, raise the level explicitly.

**Package prefix** is the short token a package owns for its **single** logs-gateway-related variable in this contract (illustrative examples: **`MY_LIB`**, **`EXAMPLE_SVC`**). Each package documents its own prefix in its README.

**logs-gateway** implements this contract inside `createLogger` / `LogsGateway`. It also exposes **`resolvePackageLogsLevel`**, **`parsePackageLogsLevelString`**, **`packageLogsLevelEnvKey`**, and **`legacyPackageLogLevelEnvKey`** for the same rules outside the gateway if needed.

---

## For package authors — how to implement

1. **Depend on** `logs-gateway` (normal `dependencies` for a library that logs).
2. **Choose a stable prefix** (short acronym, not the full scoped npm name). Use the same string for **`envPrefix`** and for documenting the env var (e.g. **`MY_LIB`** → **`MY_LIB_LOGS_LEVEL`**).
3. **Create one logger** (or one per logical surface, each with its own prefix if you truly need separate toggles—usually one prefix per package):

   ```typescript
   import { createLogger } from 'logs-gateway';

   export const logger = createLogger({
     packageName: 'MyLib',        // label in log lines
     envPrefix: 'MY_LIB',         // reads MY_LIB_LOGS_LEVEL / MY_LIB_LOG_LEVEL
     debugNamespace: 'my-lib'     // optional: DEBUG namespace
   });
   ```

4. **Emit using gateway levels** — `logger.error`, `logger.warn`, `logger.info`, `logger.debug`, `logger.verbose`. What actually appears is filtered by the resolved **minimum level** (see table below).
5. **Document for consumers** in your README: the prefix, the exact key **`<prefix>_LOGS_LEVEL`**, allowed values, and that **default is `warn`** if the variable is not set (and legacy **`_LOG_LEVEL`** is not set).
6. **Optional programmatic default** — pass **`logLevel`** in the second argument to **`createLogger`** only when you need a non-env default (it overrides env for that instance).

You do **not** need to read **`process.env`** for the level yourself if you use **`createLogger`** / **`LogsGateway`**; resolution is built in.

---

## For apps and operators — downstream (different levels per package)

Integrators tune **verbosity per dependency** by setting **one variable per package prefix** in **`.env`** (or the host’s secret/config store). That flows **downstream** into each library’s logger without code changes:

```dotenv
# Quieter third-party package; louder in-house library
EXAMPLE_GATEWAY_LOGS_LEVEL=error
MY_LIB_LOGS_LEVEL=info

# Turn one package off entirely
OTHER_PKG_LOGS_LEVEL=off
```

Cross-cutting knobs (**where** logs go, **format**, file paths, unified sink, etc.) are configured **once** for the host (see logs-gateway README), not duplicated per package prefix.

---

## 1. Package-level variable (only): `<packagePrefix>_LOGS_LEVEL`

```dotenv
MY_LIB_LOGS_LEVEL=warn
```

Pattern: **`<packagePrefix>_LOGS_LEVEL`**.

- If **both** **`<packagePrefix>_LOGS_LEVEL`** and **`<packagePrefix>_LOG_LEVEL`** are **absent** from the environment, **logs-gateway** uses **`warn`** as the effective threshold.
- **`off`** (or **`none`** / **`silent`**) means that package does **not** emit diagnostic logs (regardless of cross-cutting sink configuration).

No other **package-prefixed** `.env` keys are part of this contract—**not** `<packagePrefix>_LOG_TO_CONSOLE`, `<packagePrefix>_LOG_TO_FILE`, `<packagePrefix>_LOG_FORMAT`, etc. Those belong to **cross-cutting** configuration.

---

## 2. Allowed values for `<packagePrefix>_LOGS_LEVEL`

| Value | Meaning |
|--------|---------|
| **`off`** | Package diagnostics disabled (`none` / `silent` are synonyms). |
| **`error`** | Emit **`error`** only. |
| **`warn`** | Emit **`warn`** and **`error`**. |
| **`info`** | Emit **`info`** and above. |
| **`debug`** | Emit **`debug`** and above. |
| **`verbose`** | Most verbose. |

**Default when the env keys are not set:** **`warn`** (see §1).

Case-insensitive values are recommended; **logs-gateway** normalizes case when parsing.

Unknown values are treated as **`off`** (silent) in **logs-gateway**.

**Precedence in env:** if **both** **`_LOGS_LEVEL`** and **`_LOG_LEVEL`** are set, **`_LOGS_LEVEL`** wins. If only **`_LOG_LEVEL`** is set (legacy), it is used the same way as **`_LOGS_LEVEL`**.

---

## 3. Cross-cutting configuration (shared across packages)

**Console, file, log file path, text/json/table format, unified logger, and similar** are **application- or host-level** concerns. They apply **once** to the process, not once per library prefix.

- A package with **`_LOGS_LEVEL=off`** must not emit diagnostics; host settings do not override that.
- When the package level is not **`off`**, lines use the **same** shared sinks and format as other packages that are allowed to emit.

Exact host variable names are in **logs-gateway** and application docs; they are not **`<packagePrefix>_…`** patterns in this contract.

---

## 4. Choosing the package prefix

- Prefer a **stable acronym or short name**, not the full scoped npm name.
- Example (illustrative): **`@acme/example-lib`** might use **`EXAMPLE_LIB`**—pick one and keep it.

Document the prefix and **`<prefix>_LOGS_LEVEL`** in the package README.

---

## 5. Example `.env` (placeholders)

**Per package (levels only):**

```dotenv
MY_LIB_LOGS_LEVEL=warn
EXAMPLE_GATEWAY_LOGS_LEVEL=info

# Silence or debug one layer
OTHER_PKG_LOGS_LEVEL=off
MY_LIB_LOGS_LEVEL=debug
```

**Cross-cutting (illustrative—host / logs-gateway global keys):**

```dotenv
# LOG_TO_CONSOLE=true
# LOG_FORMAT=json
```

---

## 6. Interaction with process-wide `DEBUG`

Some stacks use **`DEBUG`** (comma-separated namespaces). That is separate from this contract:

- **`_LOGS_LEVEL=off`** stays authoritative: the package stays silent in **logs-gateway**.
- **`DEBUG`** can still allow **`verbose`** / **`debug`** lines **only when the package is not silent** (`packageLogsDisabled` is false). See **logs-gateway** README for details.

---

## 7. Summary

| Layer | What is configured |
|--------|-------------------|
| **Per package** | **Only** `<packagePrefix>_LOGS_LEVEL` (default **`warn`** when both `_LOGS_LEVEL` and `_LOG_LEVEL` are unset in the environment) |
| **Cross-cutting** | Console, file, format, unified sink, etc.—**once** for the app / process |

---

## 8. Migration note

If you relied on older behavior where **no** env vars implied **silent** output, set **`{PREFIX}_LOGS_LEVEL=off`** explicitly, or **`{PREFIX}_LOG_LEVEL=off`** if you only use the legacy key.
