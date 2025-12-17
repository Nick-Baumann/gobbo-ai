package com.steipete.clawdis.node

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch

class NodeForegroundService : Service() {
  private val scope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
  private var notificationJob: Job? = null

  override fun onCreate() {
    super.onCreate()
    ensureChannel()
    val initial = buildNotification(title = "Clawdis Node", text = "Starting…")
    if (Build.VERSION.SDK_INT >= 29) {
      startForeground(NOTIFICATION_ID, initial, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
    } else {
      startForeground(NOTIFICATION_ID, initial)
    }

    val runtime = (application as NodeApp).runtime
    notificationJob =
      scope.launch {
        combine(runtime.statusText, runtime.serverName, runtime.isConnected) { status, server, connected ->
          Triple(status, server, connected)
        }.collect { (status, server, connected) ->
          val title = if (connected) "Clawdis Node · Connected" else "Clawdis Node"
          val text = server?.let { "$status · $it" } ?: status
          updateNotification(buildNotification(title = title, text = text))
        }
      }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        (application as NodeApp).runtime.disconnect()
        stopSelf()
        return START_NOT_STICKY
      }
    }
    // Keep running; connection is managed by NodeRuntime (auto-reconnect + manual).
    return START_STICKY
  }

  override fun onDestroy() {
    notificationJob?.cancel()
    scope.cancel()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?) = null

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val mgr = getSystemService(NotificationManager::class.java)
    val channel =
      NotificationChannel(
        CHANNEL_ID,
        "Connection",
        NotificationManager.IMPORTANCE_LOW,
      ).apply {
        description = "Clawdis node connection status"
        setShowBadge(false)
      }
    mgr.createNotificationChannel(channel)
  }

  private fun buildNotification(title: String, text: String): Notification {
    val stopIntent = Intent(this, NodeForegroundService::class.java).setAction(ACTION_STOP)
    val flags =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      } else {
        PendingIntent.FLAG_UPDATE_CURRENT
      }
    val stopPending = PendingIntent.getService(this, 2, stopIntent, flags)

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle(title)
      .setContentText(text)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
      .addAction(0, "Disconnect", stopPending)
      .build()
  }

  private fun updateNotification(notification: Notification) {
    val mgr = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    mgr.notify(NOTIFICATION_ID, notification)
  }

  companion object {
    private const val CHANNEL_ID = "connection"
    private const val NOTIFICATION_ID = 1

    private const val ACTION_STOP = "com.steipete.clawdis.node.action.STOP"

    fun start(context: Context) {
      val intent = Intent(context, NodeForegroundService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun stop(context: Context) {
      val intent = Intent(context, NodeForegroundService::class.java).setAction(ACTION_STOP)
      context.startService(intent)
    }
  }
}
