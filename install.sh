#!/bin/bash


echo "initializing..."

# make sure that the required programs are installed
if command -v node >/dev/null 2>&1 ; then
    echo "node found version: $(node -v)"
else
    echo "node not found checking for nodejs ..."
    # make sure that the required programs are installed
    if command -v nodejs >/dev/null 2>&1 ; then
        echo "node found version: $(nodejs -v)"
    else
        echo -e "\e[31mnode.js is required, ending...\e[39m"
        exit
    fi
fi

if command -v mysql >/dev/null 2>&1 ; then
    echo "mysql found version: $(mysql -V)"
else
    echo -e "\e[31mmysql is required, ending...\e[39m"
    exit
fi

npm install

echo "if you are running this on the server that has already had the database created exit here."

echo -n "SQL root username(): "
read rootUser
echo -n "SQL root password(): "
read rootPass
echo ""

echo -n "Database host(localhost): "
read DBHOST
echo -n "Database port number(3306): "
read DBPORT
echo -n "Database name(cis3750): "
read DBNAME

echo ""
echo -n "Database username(cis3750_node): "
read DBUSERNAME
echo -n "Database password(team31): "
read DBPASSWORD

echo -n "node server Port Number (3000): "
read PORT

echo -n "Firebase .json file(): "
read FIREBASEACC
echo -n "Firebase database URL(): "
read FIREBASEDB



if [[ -z "$DBHOST" ]]; then
    DBHOST="localhost"
fi

if [[ -z "$DBPORT" ]]; then
    DBPORT="3306"
fi

if [[ -z "$PORT" ]]; then
    PORT="3000"
fi

if [[ -z "$DBUSERNAME" ]]; then
    DBUSERNAME="cis3750_node"
fi

if [[ -z "$DBPASSWORD" ]]; then
    DBPASSWORD="team31"
fi

if [[ -z "$DBNAME" ]]; then
    DBNAME="cis3750"
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


# create production database
TEMP=`mktemp` || exit 1
sed -e "s/{{USERNAME}}/$DBUSERNAME/g" -e "s/{{PASSWORD}}/$DBPASSWORD/g"  -e "s/{{DATABASE}}/$DBNAME/g" script.sql > $TEMP
cat $TEMP
mysql -u $rootUser --host $DBHOST -p$rootPass < $TEMP
