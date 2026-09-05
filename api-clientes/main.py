import os
import pymysql
from app import app
from db_config import mysql
from flask import jsonify, request


@app.route('/', methods=['GET'])
def health():
	return jsonify({'status': 'ok', 'servicio': 'api-clientes'}), 200


@app.route('/clientes', methods=['GET'])
def listar_clientes():
	conn = cursor = None
	try:
		conn = mysql.connect()
		cursor = conn.cursor(pymysql.cursors.DictCursor)
		cursor.execute("SELECT * FROM clientes")
		rows = cursor.fetchall()
		return jsonify(rows), 200
	except Exception as e:
		print(e)
		return jsonify({'error': 'Error al listar clientes'}), 500
	finally:
		if cursor: cursor.close()
		if conn: conn.close()


@app.route('/clientes/<int:id>', methods=['GET'])
def obtener_cliente(id):
	conn = cursor = None
	try:
		conn = mysql.connect()
		cursor = conn.cursor(pymysql.cursors.DictCursor)
		cursor.execute("SELECT * FROM clientes WHERE id = %s", (id,))
		row = cursor.fetchone()
		if not row:
			return jsonify({'error': 'Cliente no encontrado'}), 404
		return jsonify(row), 200
	except Exception as e:
		print(e)
		return jsonify({'error': 'Error al buscar el cliente'}), 500
	finally:
		if cursor: cursor.close()
		if conn: conn.close()


@app.route('/clientes', methods=['POST'])
def crear_cliente():
	conn = cursor = None
	try:
		data = request.get_json()
		nombre = data['nombre']
		email = data['email']
		dni = data.get('dni')
		conn = mysql.connect()
		cursor = conn.cursor()
		cursor.execute(
			"INSERT INTO clientes (nombre, email, dni) VALUES (%s, %s, %s)",
			(nombre, email, dni)
		)
		conn.commit()
		return jsonify({'id': cursor.lastrowid, 'nombre': nombre, 'email': email, 'dni': dni}), 201
	except Exception as e:
		print(e)
		return jsonify({'error': 'Error al crear el cliente'}), 500
	finally:
		if cursor: cursor.close()
		if conn: conn.close()


@app.route('/clientes/<int:id>', methods=['PUT'])
def actualizar_cliente(id):
	conn = cursor = None
	try:
		data = request.get_json()
		nombre = data['nombre']
		email = data['email']
		dni = data.get('dni')
		conn = mysql.connect()
		cursor = conn.cursor()
		cursor.execute(
			"UPDATE clientes SET nombre=%s, email=%s, dni=%s WHERE id=%s",
			(nombre, email, dni, id)
		)
		conn.commit()
		if cursor.rowcount == 0:
			return jsonify({'error': 'Cliente no encontrado'}), 404
		return jsonify({'id': id, 'nombre': nombre, 'email': email, 'dni': dni}), 200
	except Exception as e:
		print(e)
		return jsonify({'error': 'Error al actualizar el cliente'}), 500
	finally:
		if cursor: cursor.close()
		if conn: conn.close()


@app.route('/clientes/<int:id>', methods=['DELETE'])
def borrar_cliente(id):
	conn = cursor = None
	try:
		conn = mysql.connect()
		cursor = conn.cursor()
		cursor.execute("DELETE FROM clientes WHERE id=%s", (id,))
		conn.commit()
		if cursor.rowcount == 0:
			return jsonify({'error': 'Cliente no encontrado'}), 404
		return '', 204
	except Exception as e:
		print(e)
		return jsonify({'error': 'Error al borrar el cliente'}), 500
	finally:
		if cursor: cursor.close()
		if conn: conn.close()


if __name__ == "__main__":
	app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8080)))
