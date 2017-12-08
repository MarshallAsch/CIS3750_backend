#!/bin/bash


echo "initializing..."

echo ""
echo ""

# make sure that the required programs are installed
if command -v node >/dev/null 2>&1 ; then
    echo "node found version: $(node -v)"
else
    echo "\e[31mnode.js is required, ending...\e[39m"
    exit 1
fi

if command -v mysql >/dev/null 2>&1 ; then
    echo "mysql found version: $(mysql -V)"
else
    echo "\e[31mmysql is required, ending...\e[39m"
    exit 1
fi

echo ""
echo ""



# get the data from the user about the database from the user so
# that they are not hard coded into the app or in version control
echo -n "Server Port Number (3000): "
read PORT
echo -n "Database host(localhost): "
read DBHOST
echo -n "Database port number(3306): "
read DBPORT
echo -n "Database name(cis3750): "
read DBNAME
echo -n "Database username(cis3750_node): "
read DBUSERNAME
echo -n "Database password(): "
read DBPASSWORD

echo -n "Firebase .json file(): "
read FIREBASEACC
echo -n "Firebase database URL(): "
read FIREBASEDB

if [[ -z "$DBPORT" ]]; then
    DBPORT="3306"
fi

if [[ -z "$PORT" ]]; then
    PORT="3000"
fi

if [[ -z "$DBHOST" ]]; then
    DBHOST="localhost"
fi

if [[ -z "$DBNAME" ]]; then
    DBNAME="cis3750"
fi

if [[ -z "$DBUSERNAME" ]]; then
    DBUSERNAME="cis3750_node"
fi

if [[ -z "$DBPASSWORD" ]]; then
    echo "Missing password, ending... "
    exit 1
fi

if [[ -z "$FIREBASEACC" ]]; then
    FIREBASEACC="cis3750team31-firebase-adminsdk-sm0bf-189b38796f.json"
fi

if [[ -z "$FIREBASEDB" ]]; then
    FIREBASEDB="https://cis3750team31.firebaseio.com"
fi

sed -e "s/{{PORT}}/$PORT/g"  \
-e "s/{{DBPORT}}/$DBPORT/g"  \
-e "s/{{DBHOST}}/$DBHOST/g"  \
-e "s/{{DBNAME}}/$DBNAME/g" \
-e "s/{{DBUSERNAME}}/$DBUSERNAME/g" \
-e "s/{{DBPASSWORD}}/$DBPASSWORD/g" \
-e "s/{{FIREBASEACC}}/$FIREBASEACC/g"\
-e "s/{{FIREBASEDB}}/$FIREBASEDB/g" config.env.example > config.env
