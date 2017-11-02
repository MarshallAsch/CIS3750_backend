#!/bin/bash


echo "initializing..."

# make sure that the required programs are installed
if command -v node >/dev/null 2>&1 ; then
    echo "node found version: $(node -v)"
else
    echo "\e[31mnode.js is required, ending...\e[39m"
    exit
fi

if command -v mysql >/dev/null 2>&1 ; then
    echo "mysql found version: $(mysql -V)"
else
    echo "\e[31mmysql is required, ending...\e[39m"
    exit
fi

echo "\e[31CHANGE THE DEFAULT USERNAME AND PASSWORD BEFORE IT IS IN PRODUCTION!!!\e[39m"


# get the data from the user about the database from the user so
# that they are not hard coded into the app or in version control
echo -n "PortNumber (3000): "
read PORT
echo -n "Database host(localhost): "
read DBHOST
echo -n "Database name(cis3750): "
read DBNAME
echo -n "Database username(cis3750_node): "
read DBUSERNAME
echo -n "Database password(team31): "
read DBPASSWORD



#add something to start the init.d service here


PORT=$PORT DBHOST=$DBHOST DBNAME=$DBNAME DBUSERNAME=$DBUSERNAME DBPASSWORD=$DBPASSWORD node app.js







