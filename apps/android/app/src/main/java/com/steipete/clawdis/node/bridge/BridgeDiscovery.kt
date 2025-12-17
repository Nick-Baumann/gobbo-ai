package com.steipete.clawdis.node.bridge

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.os.Build
import java.net.InetAddress
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import org.xbill.DNS.Lookup
import org.xbill.DNS.PTRRecord
import org.xbill.DNS.SRVRecord
import org.xbill.DNS.TXTRecord
import org.xbill.DNS.Type

class BridgeDiscovery(
  context: Context,
  private val scope: CoroutineScope,
  discoveryDomain: StateFlow<String>,
) {
  private val nsd = context.getSystemService(NsdManager::class.java)
  private val serviceType = "_clawdis-bridge._tcp."

  private val byId = ConcurrentHashMap<String, BridgeEndpoint>()
  private val _bridges = MutableStateFlow<List<BridgeEndpoint>>(emptyList())
  val bridges: StateFlow<List<BridgeEndpoint>> = _bridges.asStateFlow()

  private var activeDomain: String = normalizeDomain(discoveryDomain.value)
  private var unicastJob: Job? = null

  private val discoveryListener =
    object : NsdManager.DiscoveryListener {
      override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {}
      override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {}
      override fun onDiscoveryStarted(serviceType: String) {}
      override fun onDiscoveryStopped(serviceType: String) {}

      override fun onServiceFound(serviceInfo: NsdServiceInfo) {
        if (serviceInfo.serviceType != this@BridgeDiscovery.serviceType) return
        resolve(serviceInfo)
      }

      override fun onServiceLost(serviceInfo: NsdServiceInfo) {
        val id = stableId(serviceInfo.serviceName, "local.")
        byId.remove(id)
        publish()
      }
    }

  init {
    scope.launch {
      discoveryDomain.collect { raw ->
        val normalized = normalizeDomain(raw)
        if (normalized == activeDomain) return@collect
        activeDomain = normalized
        restartDiscovery()
      }
    }
    restartDiscovery()
  }

  private fun restartDiscovery() {
    byId.clear()
    publish()

    stopLocalDiscovery()
    unicastJob?.cancel()
    unicastJob = null

    if (activeDomain == "local.") {
      startLocalDiscovery()
    } else {
      startUnicastDiscovery(activeDomain)
    }
  }

  private fun startLocalDiscovery() {
    try {
      nsd.discoverServices(serviceType, NsdManager.PROTOCOL_DNS_SD, discoveryListener)
    } catch (_: Throwable) {
      // ignore (best-effort)
    }
  }

  private fun stopLocalDiscovery() {
    try {
      nsd.stopServiceDiscovery(discoveryListener)
    } catch (_: Throwable) {
      // ignore (best-effort)
    }
  }

  private fun startUnicastDiscovery(domain: String) {
    unicastJob =
      scope.launch(Dispatchers.IO) {
        while (true) {
          try {
            refreshUnicast(domain)
          } catch (_: Throwable) {
            // ignore (best-effort)
          }
          delay(5000)
        }
      }
  }

  private fun resolve(serviceInfo: NsdServiceInfo) {
    nsd.resolveService(
      serviceInfo,
      object : NsdManager.ResolveListener {
        override fun onResolveFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {}

        override fun onServiceResolved(resolved: NsdServiceInfo) {
          val host = resolved.host?.hostAddress ?: return
          val port = resolved.port
          if (port <= 0) return

          val displayName = txt(resolved, "displayName") ?: resolved.serviceName
          val id = stableId(resolved.serviceName, "local.")
          byId[id] = BridgeEndpoint(stableId = id, name = displayName, host = host, port = port)
          publish()
        }
      },
    )
  }

  private fun publish() {
    _bridges.value = byId.values.sortedBy { it.name.lowercase() }
  }

  private fun stableId(serviceName: String, domain: String): String {
    return "${serviceType}|${domain}|${normalizeName(serviceName)}"
  }

  private fun normalizeName(raw: String): String {
    return raw.trim().split(Regex("\\s+")).joinToString(" ")
  }

  private fun txt(info: NsdServiceInfo, key: String): String? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) return null
    val bytes = info.attributes[key] ?: return null
    return try {
      String(bytes, Charsets.UTF_8).trim().ifEmpty { null }
    } catch (_: Throwable) {
      null
    }
  }

  private suspend fun refreshUnicast(domain: String) {
    val ptrName = "${serviceType}${domain}"
    val ptrRecords = lookup(ptrName, Type.PTR).mapNotNull { it as? PTRRecord }

    val next = LinkedHashMap<String, BridgeEndpoint>()
    for (ptr in ptrRecords) {
      val instanceFqdn = ptr.target.toString()
      val srv = lookup(instanceFqdn, Type.SRV).firstOrNull { it is SRVRecord } as? SRVRecord ?: continue
      val port = srv.port
      if (port <= 0) continue

      val targetName = stripTrailingDot(srv.target.toString())
      val host =
        try {
          InetAddress.getAllByName(targetName)
            .map { it.hostAddress }
            .firstOrNull { !it.contains(":") } ?: InetAddress.getAllByName(targetName).firstOrNull()?.hostAddress
        } catch (_: Throwable) {
          null
        } ?: continue

      val txt = lookup(instanceFqdn, Type.TXT).mapNotNull { it as? TXTRecord }
      val instanceName = decodeInstanceName(instanceFqdn, domain)
      val displayName = txtValue(txt, "displayName") ?: instanceName
      val id = stableId(instanceName, domain)
      next[id] = BridgeEndpoint(stableId = id, name = displayName, host = host, port = port)
    }

    byId.clear()
    byId.putAll(next)
    publish()
  }

  private fun decodeInstanceName(instanceFqdn: String, domain: String): String {
    val suffix = "${serviceType}${domain}"
    val withoutSuffix =
      if (instanceFqdn.endsWith(suffix)) {
        instanceFqdn.removeSuffix(suffix)
      } else {
        instanceFqdn.substringBefore(serviceType)
      }
    return normalizeName(stripTrailingDot(withoutSuffix))
  }

  private fun normalizeDomain(raw: String): String {
    val trimmed = raw.trim().lowercase()
    if (trimmed.isEmpty() || trimmed == "local" || trimmed == "local.") return "local."
    return if (trimmed.endsWith(".")) trimmed else "$trimmed."
  }

  private fun stripTrailingDot(raw: String): String {
    return raw.removeSuffix(".")
  }

  private fun lookup(name: String, type: Int): List<org.xbill.DNS.Record> {
    return try {
      val out = Lookup(name, type).run() ?: return emptyList()
      out.toList()
    } catch (_: Throwable) {
      emptyList()
    }
  }

  private fun txtValue(records: List<TXTRecord>, key: String): String? {
    val prefix = "$key="
    for (r in records) {
      val strings =
        try {
          r.strings
        } catch (_: Throwable) {
          emptyList()
        }
      for (s in strings.filterNotNull()) {
        val trimmed = s.trim()
        if (trimmed.startsWith(prefix)) {
          return trimmed.removePrefix(prefix).trim().ifEmpty { null }
        }
      }
    }
    return null
  }
}
