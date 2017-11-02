#!/bin/bash


echo "initializing..."

# make sure that the required programs are installed
if command -v node >/dev/null 2>&1 ; then
    echo "node found version: $(node -v)"
else
    echo -e "\e[31mnode.js is required, ending...\e[39m"
    exit
fi

if command -v mysql >/dev/null 2>&1 ; then
    echo "mysql found version: $(mysql -V)"
else
    echo -e "\e[31mmysql is required, ending...\e[39m"
    exit
fi


echo -e "\e[31mCHANGE THE DEFAULT USERNAME AND PASSWORD BEFORE IT IS IN PRODUCTION!!!\e[39m"

echo -n "SQL root username(cis3750_node): "
read rootUser
echo -n "SQL root password(team31): "
read rootPass

echo -n "Database username(cis3750_node): "
read DBUSERNAME
echo -n "Database password(team31): "
read DBPASSWORD


echo -n "Database name(cis3750): "
read DBNAME



if [[ -z "$DBUSERNAME" ]]; then
	DBUSERNAME="cis3750_node"
fi

if [[ -z "$DBPASSWORD" ]]; then
	DBPASSWORD="team31"
fi

if [[ -z "$DBNAME" ]]; then
	DBNAME="cis3750"
fi


# replace the username and password in the script with the ones given here

TEMP=`mktemp` || exit 1

sed -e "s/{{USERNAME}}/$DBUSERNAME/g" -e "s/{{PASSWORD}}/$DBPASSWORD/g"  -e "s/{{DATABASE}}/$DBNAME/g" script.sql > $TEMP

cat $TEMP


mysql -u $rootUser --host $DBHOST -p$rootPass < $TEMP



# check and create the init.d script here






