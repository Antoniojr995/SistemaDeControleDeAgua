#include <WiFi.h>
#include <HTTPClient.h>

// Pinos dos sensores ultrassônicos e bomba
const int trigPin1 = 5;
const int echoPin1 = 18;
const int trigPin2 = 19;
const int echoPin2 = 21;
const int bomba1Pin = 26; // pino da bomba

// Wi-Fi
const char* ssid = "antonio";
const char* password = "antonio123";

// IP do servidor backend (o do seu PC com Node.js)
const char* serverUrl = "http://192.168.0.10:3000";  // coloque seu IP aqui!

#define SOUND_SPEED 0.034

float distanceCm1, distanceCm2;
unsigned long lastSend = 0;
const unsigned long sendInterval = 5000; // enviar a cada 5s

void setup() {
  Serial.begin(115200);
  pinMode(trigPin1, OUTPUT);
  pinMode(echoPin1, INPUT);
  pinMode(trigPin2, OUTPUT);
  pinMode(echoPin2, INPUT);
  pinMode(bomba1Pin, OUTPUT);
  digitalWrite(bomba1Pin, LOW);

  WiFi.begin(ssid, password);
  Serial.print("Conectando ao Wi-Fi...");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("Conectado! IP: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  distanceCm1 = lerSensor(trigPin1, echoPin1);
  distanceCm2 = lerSensor(trigPin2, echoPin2);

  if (millis() - lastSend > sendInterval) {
    enviarLeituras(distanceCm1, distanceCm2);
    checarComandoBomba();
    lastSend = millis();
  }

  delay(200);
}

float lerSensor(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  long duration = pulseIn(echoPin, HIGH, 30000);
  if (duration == 0) return 0;
  return (duration * SOUND_SPEED) / 2.0;
}

void enviarLeituras(float c1, float c2) {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  String url = String(serverUrl) + "/api/dados";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  String payload = "{\"caixa1\": " + String(c1, 2) + ", \"caixa2\": " + String(c2, 2) + ", \"bomba\": 0}";
  int httpCode = http.POST(payload);

  Serial.printf("Enviando dados: %s -> HTTP %d\n", payload.c_str(), httpCode);
  http.end();
}

void checarComandoBomba() {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  String url = String(serverUrl) + "/api/bomba/status";
  http.begin(url);
  int httpCode = http.GET();

  if (httpCode == 200) {
    String resp = http.getString();
    int pos = resp.indexOf("bomba");
    if (pos != -1) {
      int valor = resp.substring(resp.indexOf(':', pos) + 1).toInt();
      digitalWrite(bomba1Pin, valor ? HIGH : LOW);
      Serial.printf("Status da bomba: %d\n", valor);
    }
  }
  http.end();
}
